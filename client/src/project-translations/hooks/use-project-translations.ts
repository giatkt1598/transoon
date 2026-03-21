import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'react-toastify'
import type {
  ProjectAutoTranslateProgressResponse,
  ProjectDetail,
  ProjectSegment,
  TranslateProviderOption,
} from '../../app/types'
import { getAppSocket } from '../../app/socket'
import { fetchSettings } from '../../settings-management/api'
import {
  autoTranslateProject,
  exportProjectDocument,
  fetchProjectDetail,
  fetchProjectSegments,
  generateProjectSegments,
  inlineTranslateProjectSegment,
  saveProjectSegments,
} from '../../project-management/api'

type UseProjectTranslationsOptions = {
  projectId?: string
  projectDetail: ProjectDetail | null
  translateProviders: TranslateProviderOption[]
  isActive: boolean
  onProjectDetailChange: Dispatch<SetStateAction<ProjectDetail | null>>
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
  const [isSavingSegments, setIsSavingSegments] = useState(false)
  const [isExportingDocument, setIsExportingDocument] = useState(false)
  const [segmentSaveRevision, setSegmentSaveRevision] = useState(0)
  const [activeSegmentExternalId, setActiveSegmentExternalId] = useState<string | null>(null)
  const [isAutoTranslateDialogOpen, setIsAutoTranslateDialogOpen] = useState(false)
  const [isStartingAutoTranslate, setIsStartingAutoTranslate] = useState(false)
  const [selectedProviderName, setSelectedProviderName] = useState('')
  const [autoTranslateProgress, setAutoTranslateProgress] = useState<ProjectAutoTranslateProgressResponse | null>(null)
  const [segmentsError, setSegmentsError] = useState<string | null>(null)
  const [savedSegmentTargets, setSavedSegmentTargets] = useState<Record<string, string>>({})
  const [inlineTranslatingSegmentId, setInlineTranslatingSegmentId] = useState<string | null>(null)
  const [inlineTranslateProviderName, setInlineTranslateProviderName] = useState<string>('')
  const [inlineCaretRestoreSegmentId, setInlineCaretRestoreSegmentId] = useState<string | null>(null)
  const [inlineCaretRestoreToken, setInlineCaretRestoreToken] = useState(0)
  const inlineTranslationRef = useRef<{
    segmentId: string
    requestId: number
    controller: AbortController
  } | null>(null)
  const projectStatus = projectDetail?.status
  const projectSegmentCount = projectDetail?.segmentCount ?? 0

  useEffect(() => {
    if (!projectId || !isActive) {
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
        setSavedSegmentTargets(createSavedSegmentTargetMap(nextSegments))
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
  }, [isActive, projectId, projectSegmentCount, projectStatus])

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
    const controller = new AbortController()

    async function loadInlineTranslateProvider() {
      try {
        const settings = await fetchSettings(controller.signal)
        setInlineTranslateProviderName(settings.inlineTranslateProvider)
      } catch {
        // Ignore settings load failures here; placeholder can fall back silently.
      }
    }

    void loadInlineTranslateProvider()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!projectId || projectStatus !== 'auto-translate-processing') {
      return
    }

    const socket = getAppSocket()
    const resolvedProjectId = projectId
    const handleProgress = async (progress: ProjectAutoTranslateProgressResponse) => {
      if (progress.projectId !== resolvedProjectId) {
        return
      }

      setAutoTranslateProgress(progress)
      onProjectDetailChange((currentProjectDetail) => {
        if (!currentProjectDetail) {
          return currentProjectDetail
        }

        const translatedSegmentCount =
          progress.phase === 'failed'
            ? currentProjectDetail.translatedSegmentCount
            : Math.max(currentProjectDetail.translatedSegmentCount, progress.completedSegments)
        const progressPercent =
          progress.totalSegments > 0
            ? Math.round((translatedSegmentCount / progress.totalSegments) * 100)
            : currentProjectDetail.progressPercent

        return {
          ...currentProjectDetail,
          translatedSegmentCount,
          progressPercent,
        }
      })

      if (progress.phase === 'completed' || progress.phase === 'failed') {
        try {
          const [nextProjectDetail, nextSegments] = await Promise.all([
            fetchProjectDetail(resolvedProjectId),
            fetchProjectSegments(resolvedProjectId),
          ])

          onProjectDetailChange(nextProjectDetail)
          setSegments(nextSegments)
          setSavedSegmentTargets(createSavedSegmentTargetMap(nextSegments))

          if (progress.phase === 'completed') {
            toast.success('Auto translate finished successfully.')
          } else {
            toast.error(progress.message)
          }
        } catch {
          // Preserve existing screen state if the final refresh fails.
        }
      }
    }

    socket.on('project-auto-translate-progress', handleProgress)
    socket.emit('project-auto-translate:subscribe', resolvedProjectId)

    return () => {
      socket.emit('project-auto-translate:unsubscribe', resolvedProjectId)
      socket.off('project-auto-translate-progress', handleProgress)
    }
  }, [onProjectDetailChange, projectId, projectStatus])

  const hasSegments = useMemo(() => segments.length > 0, [segments])
  const isReadOnly = projectStatus === 'auto-translate-processing'
  const hasPendingSegmentChanges = useMemo(
    () => segments.some((segment) => (savedSegmentTargets[segment.id] ?? '') !== segment.targetText),
    [savedSegmentTargets, segments],
  )

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

    if (inlineTranslationRef.current?.segmentId === segmentId) {
      inlineTranslationRef.current.controller.abort()
      inlineTranslationRef.current = null
      setInlineTranslatingSegmentId(null)
    }

    setSegments((current) =>
      current.map((segment) => (segment.id === segmentId ? { ...segment, targetText } : segment)),
    )
  }

  function handleActiveSegmentChange(segmentExternalId: string | null) {
    setActiveSegmentExternalId(segmentExternalId)
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
      setSavedSegmentTargets(createSavedSegmentTargetMap(result.segments))

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

  async function saveDirtySegments() {
    if (!projectId || isReadOnly || !hasPendingSegmentChanges) {
      return null
    }

    const windowScrollY = window.scrollY
    const dirtySegments = segments
      .filter((segment) => (savedSegmentTargets[segment.id] ?? '') !== segment.targetText)
      .map((segment) => ({
        id: segment.id,
        targetText: segment.targetText,
      }))

    const result = await saveProjectSegments(projectId, dirtySegments)
    setSegments(result.segments)
    setSavedSegmentTargets(createSavedSegmentTargetMap(result.segments))

    if (result.project) {
      onProjectDetailChange(result.project)
    }

    setSegmentSaveRevision((current) => current + 1)
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: windowScrollY,
        behavior: 'instant',
      })
    })

    return result
  }

  async function handleSaveSegments() {
    try {
      setIsSavingSegments(true)
      setSegmentsError(null)
      const result = await saveDirtySegments()

      if (result) {
        toast.success('Project segments saved successfully.')
      }
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Could not save project segments.'
      setSegmentsError(message)
      toast.error(message)
    } finally {
      setIsSavingSegments(false)
    }
  }

  async function handleInlineTranslateSegment(segmentId: string) {
    if (!projectId || isReadOnly || inlineTranslatingSegmentId) {
      return
    }

    const segment = segments.find((item) => item.id === segmentId)
    if (!segment?.sourceText.trim()) {
      return
    }

    try {
      setSegmentsError(null)
      const controller = new AbortController()
      const requestId = Date.now()
      inlineTranslationRef.current = {
        segmentId,
        requestId,
        controller,
      }
      setInlineTranslatingSegmentId(segmentId)

      const result = await inlineTranslateProjectSegment(projectId, segmentId, controller.signal)

      if (
        !inlineTranslationRef.current ||
        inlineTranslationRef.current.requestId !== requestId ||
        inlineTranslationRef.current.segmentId !== segmentId
      ) {
        return
      }

      setSegments((currentSegments) =>
        currentSegments.map((currentSegment) =>
          currentSegment.id === result.segmentId
            ? {
                ...currentSegment,
                targetText: result.targetText,
              }
            : currentSegment,
        ),
      )
      setInlineCaretRestoreSegmentId(segmentId)
      setInlineCaretRestoreToken((currentValue) => currentValue + 1)
    } catch (inlineTranslateError) {
      if (inlineTranslateError instanceof Error && inlineTranslateError.name === 'AbortError') {
        return
      }

      const message =
        inlineTranslateError instanceof Error
          ? inlineTranslateError.message
          : 'Could not inline translate the segment.'
      setSegmentsError(message)
      toast.error(message)
    } finally {
      if (inlineTranslationRef.current?.segmentId === segmentId) {
        inlineTranslationRef.current = null
        setInlineTranslatingSegmentId(null)
      }
    }
  }

  useEffect(() => {
    return () => {
      inlineTranslationRef.current?.controller.abort()
    }
  }, [])

  async function handleExportDocument() {
    if (!projectId || isReadOnly || isExportingDocument) {
      return
    }

    try {
      setIsExportingDocument(true)
      setSegmentsError(null)

      if (hasPendingSegmentChanges) {
        await saveDirtySegments()
      }

      const { blob, fileName } = await exportProjectDocument(projectId)
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
      toast.success('Translated document exported successfully.')
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : 'Could not export project document.'
      setSegmentsError(message)
      toast.error(message)
    } finally {
      setIsExportingDocument(false)
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

      setAutoTranslateProgress({
        projectId,
        phase: 'queued',
        completedSegments: result.project?.translatedSegmentCount ?? projectDetail?.translatedSegmentCount ?? 0,
        totalSegments: projectSegmentCount,
        progressPercent: result.project?.progressPercent ?? projectDetail?.progressPercent ?? 0,
        message: 'Preparing background auto translate.',
        updatedAt: new Date().toISOString(),
      })
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
    isSavingSegments,
    isExportingDocument,
    segmentSaveRevision,
    activeSegmentExternalId,
    isAutoTranslateDialogOpen,
    isStartingAutoTranslate,
    selectedProviderName,
    autoTranslateProgress,
    segmentsError,
    hasPendingSegmentChanges,
    inlineTranslatingSegmentId,
    inlineTranslateProviderName,
    inlineCaretRestoreSegmentId,
    inlineCaretRestoreToken,
    setSelectedProviderName,
    handleTargetChange,
    handleActiveSegmentChange,
    handleInlineTranslateSegment,
    handleSaveSegments,
    handleExportDocument,
    handleGenerateSegments,
    handleOpenAutoTranslateDialog,
    handleCloseAutoTranslateDialog,
    handleConfirmAutoTranslate,
  }
}

function createSavedSegmentTargetMap(segments: ProjectSegment[]) {
  return Object.fromEntries(segments.map((segment) => [segment.id, segment.targetText]))
}
