import { useEffect, useMemo, useState } from 'react'
import type { ProjectSummary } from '../../app/types'
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

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) {
      return projects
    }

    return projects.filter((project) => {
      const haystacks = [project.name, project.sourceLang, project.targetLang]
      return haystacks.some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [projects, searchTerm])

  async function handleDeleteProject(projectId: string) {
    setIsDeleting(true)
    setError(null)

    try {
      await deleteProject(projectId)
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete project.')
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
