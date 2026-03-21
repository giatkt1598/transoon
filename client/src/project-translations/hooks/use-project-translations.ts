import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { ProjectDetail, ProjectSegment, TranslateProviderOption } from '../../app/types'
import { autoTranslateProject, fetchProjectSegments, generateProjectSegments } from '../../project-management/api'

type UseProjectTranslationsOptions = {
  projectId?: string
  projectDetail: ProjectDetail | null
  translateProviders: TranslateProviderOption[]
  isActive: boolean
  onProjectDetailChange: (projectDetail: ProjectDetail) => void
}

export function useProjectTranslations({
  projectId,
  projectDetail,
  translateProviders,
  isActive,
  onProjectDetailChange,
}: UseProjectTranslationsOptions) {
  const [segments, setSegments] = useState<ProjectSegment[]>([])
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const [isGeneratingSegments, setIsGeneratingSegments] = useState(false)
  const [isAutoTranslateDialogOpen, setIsAutoTranslateDialogOpen] = useState(false)
  const [isStartingAutoTranslate, setIsStartingAutoTranslate] = useState(false)
  const [selectedProviderName, setSelectedProviderName] = useState('')
  const [segmentsError, setSegmentsError] = useState<string | null>(null)
  const projectStatus = projectDetail?.status
  const projectSegmentCount = projectDetail?.segmentCount ?? 0

  useEffect(() => {
    if (!projectId || !projectDetail || !isActive) {
      return
    }

    if (projectSegmentCount === 0) {
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
  }, [isActive, projectDetail, projectSegmentCount, projectStatus, projectId])

  useEffect(() => {
    if (!translateProviders.length) {
      setSelectedProviderName('')
      return
    }

    setSelectedProviderName((currentValue) =>
      translateProviders.some((provider) => provider.name === currentValue)
        ? currentValue
        : translateProviders[0]?.name ?? '',
    )
  }, [translateProviders])

  useEffect(() => {
    if (!projectId || !projectDetail || projectStatus !== 'auto-translate-processing') {
      return
    }

    const interval = window.setInterval(() => {
      void fetchProjectSegments(projectId)
        .then((nextSegments) => setSegments(nextSegments))
        .catch(() => {
          // Preserve the latest visible segments while the background job is running.
        })
    }, 3000)

    return () => window.clearInterval(interval)
  }, [projectDetail, projectId, projectStatus])

  const hasSegments = useMemo(() => segments.length > 0, [segments])
  const isReadOnly = projectStatus === 'auto-translate-processing'

  function handleOpenAutoTranslateDialog() {
    if (isReadOnly || !hasSegments || !translateProviders.length) {
      return
    }

    setIsAutoTranslateDialogOpen(true)
  }

  function handleCloseAutoTranslateDialog() {
    if (isStartingAutoTranslate) {
      return
    }

    setIsAutoTranslateDialogOpen(false)
  }

  function handleTargetChange(segmentId: string, targetText: string) {
    if (isReadOnly) {
      return
    }

    setSegments((current) =>
      current.map((segment) => (segment.id === segmentId ? { ...segment, targetText } : segment)),
    )
  }

  async function handleGenerateSegments() {
    if (!projectId || isReadOnly) {
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

  async function handleConfirmAutoTranslate() {
    if (!projectId || !selectedProviderName) {
      return
    }

    try {
      setIsStartingAutoTranslate(true)
      setSegmentsError(null)
      const result = await autoTranslateProject(projectId, selectedProviderName)

      if (result.project) {
        onProjectDetailChange(result.project)
      }

      setIsAutoTranslateDialogOpen(false)
      toast.success('Auto translate started in the background.')
    } catch (autoTranslateError) {
      const message =
        autoTranslateError instanceof Error ? autoTranslateError.message : 'Could not start auto translate.'
      setSegmentsError(message)
      toast.error(message)
    } finally {
      setIsStartingAutoTranslate(false)
    }
  }

  return {
    segments,
    hasSegments,
    isReadOnly,
    isLoadingSegments,
    isGeneratingSegments,
    isAutoTranslateDialogOpen,
    isStartingAutoTranslate,
    selectedProviderName,
    segmentsError,
    setSelectedProviderName,
    handleTargetChange,
    handleGenerateSegments,
    handleOpenAutoTranslateDialog,
    handleCloseAutoTranslateDialog,
    handleConfirmAutoTranslate,
  }
}
