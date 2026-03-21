import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { ProjectDetail, ProjectSegment } from '../../app/types'
import { fetchProjectSegments, generateProjectSegments } from '../../project-management/api'

type UseProjectTranslationsOptions = {
  projectId?: string
  projectDetail: ProjectDetail | null
  isActive: boolean
  onProjectDetailChange: (projectDetail: ProjectDetail) => void
}

export function useProjectTranslations({
  projectId,
  projectDetail,
  isActive,
  onProjectDetailChange,
}: UseProjectTranslationsOptions) {
  const [segments, setSegments] = useState<ProjectSegment[]>([])
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const [isGeneratingSegments, setIsGeneratingSegments] = useState(false)
  const [segmentsError, setSegmentsError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !projectDetail || !isActive) {
      return
    }

    if (projectDetail.segmentCount === 0) {
      setSegments([])
      setSegmentsError(null)
      return
    }

    const controller = new AbortController()
    const resolvedProjectId = projectId

    async function loadSegments() {
      try {
        setIsLoadingSegments(true)
        setSegmentsError(null)
        const nextSegments = await fetchProjectSegments(resolvedProjectId, controller.signal)
        setSegments(nextSegments)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setSegmentsError(loadError instanceof Error ? loadError.message : 'Could not load project segments.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSegments(false)
        }
      }
    }

    void loadSegments()

    return () => controller.abort()
  }, [isActive, projectDetail, projectId])

  const hasSegments = useMemo(() => segments.length > 0, [segments])

  function handleTargetChange(segmentId: string, targetText: string) {
    setSegments((current) =>
      current.map((segment) => (segment.id === segmentId ? { ...segment, targetText } : segment)),
    )
  }

  async function handleGenerateSegments() {
    if (!projectId) {
      return
    }

    try {
      setIsGeneratingSegments(true)
      setSegmentsError(null)
      const result = await generateProjectSegments(projectId)
      setSegments(result.segments)

      if (result.project) {
        onProjectDetailChange(result.project)
      }

      toast.success('Segments generated successfully.')
    } catch (generateError) {
      const message =
        generateError instanceof Error ? generateError.message : 'Could not generate project segments.'
      setSegmentsError(message)
      toast.error(message)
    } finally {
      setIsGeneratingSegments(false)
    }
  }

  return {
    segments,
    hasSegments,
    isLoadingSegments,
    isGeneratingSegments,
    segmentsError,
    handleTargetChange,
    handleGenerateSegments,
  }
}
