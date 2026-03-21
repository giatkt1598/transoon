import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { getAppSocket } from '../../app/socket'
import type { ProjectAutoTranslateProgressResponse, ProjectSummary } from '../../app/types'
import { deleteProject, fetchProjects } from '../api'

export function useProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProjects() {
      try {
        setIsLoading(true)
        setProjects(await fetchProjects(controller.signal))
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load projects.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const processingProjectIds = projects
      .filter((project) => project.status === 'auto-translate-processing')
      .map((project) => project.id)

    if (processingProjectIds.length === 0) {
      return
    }

    const socket = getAppSocket()
    const processingProjectIdSet = new Set(processingProjectIds)

    const handleProgress = (progress: ProjectAutoTranslateProgressResponse) => {
      if (!processingProjectIdSet.has(progress.projectId)) {
        return
      }

      setProjects((currentProjects) =>
        currentProjects.map((project) => {
          if (project.id !== progress.projectId) {
            return project
          }

          return {
            ...project,
            status:
              progress.phase === 'queued' || progress.phase === 'translating'
                ? 'auto-translate-processing'
                : 'idle',
            translatedSegmentCount: progress.completedSegments,
            segmentCount: progress.totalSegments || project.segmentCount,
            progressPercent: progress.progressPercent,
          }
        }),
      )
    }

    socket.on('project-auto-translate-progress', handleProgress)
    processingProjectIds.forEach((projectId) => {
      socket.emit('project-auto-translate:subscribe', projectId)
    })

    return () => {
      processingProjectIds.forEach((projectId) => {
        socket.emit('project-auto-translate:unsubscribe', projectId)
      })
      socket.off('project-auto-translate-progress', handleProgress)
    }
  }, [projects])

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) {
      return projects
    }

    return projects.filter((project) => {
      const haystacks = [project.name, project.documentFileName ?? '', project.sourceLang, project.targetLang]
      return haystacks.some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [projects, searchTerm])

  async function handleDeleteProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId)
    const shouldDelete = window.confirm(
      `Delete "${project?.name ?? 'this project'}"? This action cannot be undone.`,
    )

    if (!shouldDelete) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await deleteProject(projectId)
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId))
      toast.success('Project deleted successfully.')
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Could not delete project.'
      setError(message)
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return {
    projects,
    filteredProjects,
    searchTerm,
    isLoading,
    isDeleting,
    error,
    setSearchTerm,
    handleDeleteProject,
  }
}
