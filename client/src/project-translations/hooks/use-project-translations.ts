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
  cancelAutoTranslateProject,
  confirmProjectSegment,
  exportProjectDocument,
  fetchProjectDetail,
  fetchProjectSegments,
  generateProjectSegments,
  inlineTranslateProjectSegment,
  mergeProjectSegments,
  saveProjectSegments,
  splitProjectSegment,
} from '../../project-management/api'

type UseProjectTranslationsOptions = {
  projectId?: string
  projectDetail: ProjectDetail | null
  translateProviders: TranslateProviderOption[]
  onProjectDetailChange: Dispatch<SetStateAction<ProjectDetail | null>>
}

export function useProjectTranslations({
  projectId,
  projectDetail,
  translateProviders,
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
  const [isCancellingAutoTranslate, setIsCancellingAutoTranslate] = useState(false)
  const [selectedProviderName, setSelectedProviderName] = useState('')
  const [autoTranslateProgress, setAutoTranslateProgress] = useState<ProjectAutoTranslateProgressResponse | null>(null)
  const [segmentsError, setSegmentsError] = useState<string | null>(null)
  const [savedSegmentTargets, setSavedSegmentTargets] = useState<Record<string, string>>({})
  const [inlineTranslatingSegmentId, setInlineTranslatingSegmentId] = useState<string | null>(null)
  const [confirmingSegmentId, setConfirmingSegmentId] = useState<string | null>(null)
  const [inlineTranslateProviderName, setInlineTranslateProviderName] = useState<string>('')
  const [termFuzzyMatchThreshold, setTermFuzzyMatchThreshold] = useState(0.9)
  const [inlineCaretRestoreSegmentId, setInlineCaretRestoreSegmentId] = useState<string | null>(null)
  const [inlineCaretRestoreToken, setInlineCaretRestoreToken] = useState(0)
  const [confirmFocusSegmentId, setConfirmFocusSegmentId] = useState<string | null>(null)
  const [confirmFocusToken, setConfirmFocusToken] = useState(0)
  const inlineTranslationRef = useRef<{
    segmentId: string
    requestId: number
    controller: AbortController
  } | null>(null)
  const projectStatus = projectDetail?.status
  const projectSegmentCount = projectDetail?.segmentCount ?? 0
  const projectSegmentCountRef = useRef(projectSegmentCount)

  useEffect(() => {
    projectSegmentCountRef.current = projectSegmentCount
  }, [projectSegmentCount])

  useEffect(() => {
    if (!projectId) {
      return
    }

    if (projectSegmentCountRef.current === 0) {
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
  }, [projectId, projectStatus])

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
        setTermFuzzyMatchThreshold(settings.termFuzzyMatchThreshold)
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

      if (progress.phase === 'completed' || progress.phase === 'failed' || progress.phase === 'cancelled') {
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
          } else if (progress.phase === 'cancelled') {
            toast.info('Auto translate was cancelled.')
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
    if (!projectId || isReadOnly) {
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

  async function handleConfirmSegment(segmentId: string, targetTextOverride?: string) {
    if (!projectId || isReadOnly || confirmingSegmentId) {
      return
    }

    const segmentIndex = segments.findIndex((item) => item.id === segmentId)
    const segment = segmentIndex >= 0 ? segments[segmentIndex] : null
    if (!segment) {
      return
    }

    try {
      setSegmentsError(null)
      setConfirmingSegmentId(segmentId)
      const result = await confirmProjectSegment(
        projectId,
        segmentId,
        targetTextOverride ?? segment.targetText,
      )

      setSegments((currentSegments) =>
        currentSegments.map((currentSegment) =>
          currentSegment.id === result.segment.id ? result.segment : currentSegment,
        ),
      )
      setSavedSegmentTargets((currentTargets) => ({
        ...currentTargets,
        [segmentId]: result.segment.targetText,
      }))
      const nextSegment = segments[segmentIndex + 1]
      if (nextSegment) {
        setConfirmFocusSegmentId(nextSegment.id)
        setConfirmFocusToken((currentValue) => currentValue + 1)
      }

      if (result.project) {
        onProjectDetailChange(result.project)
      }
    } catch (confirmError) {
      const message =
        confirmError instanceof Error ? confirmError.message : 'Could not confirm the segment.'
      setSegmentsError(message)
      toast.error(message)
    } finally {
      setConfirmingSegmentId(null)
    }
  }

  async function handleMergeSegments(segmentIds: string[]) {
    if (!projectId || isReadOnly || segmentIds.length !== 2) {
      return
    }

    try {
      setSegmentsError(null)

      if (hasPendingSegmentChanges) {
        await saveDirtySegments()
      }

      const result = await mergeProjectSegments(projectId, segmentIds)
      setSegments(result.segments)
      setSavedSegmentTargets(createSavedSegmentTargetMap(result.segments))

      if (result.project) {
        onProjectDetailChange(result.project)
      }

      setActiveSegmentExternalId(result.mergedSegment.externalSegmentId)
      toast.success('Segments merged successfully.')
    } catch (mergeError) {
      const message =
        mergeError instanceof Error ? mergeError.message : 'Could not merge the selected segments.'
      setSegmentsError(message)
      toast.error(message)
    }
  }

  async function handleSplitSegment(segmentId: string, splitIndex: number) {
    if (!projectId || isReadOnly) {
      return
    }

    try {
      setSegmentsError(null)

      if (hasPendingSegmentChanges) {
        await saveDirtySegments()
      }

      const result = await splitProjectSegment(projectId, segmentId, splitIndex)
      setSegments(result.segments)
      setSavedSegmentTargets(createSavedSegmentTargetMap(result.segments))

      if (result.project) {
        onProjectDetailChange(result.project)
      }

      if (result.segmentsCreated[0]) {
        setActiveSegmentExternalId(result.segmentsCreated[0].externalSegmentId)
      }

      toast.success('Segment split successfully.')
    } catch (splitError) {
      const message =
        splitError instanceof Error ? splitError.message : 'Could not split the segment.'
      setSegmentsError(message)
      toast.error(message)
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

  async function handleCancelAutoTranslate() {
    if (!projectId || projectStatus !== 'auto-translate-processing') {
      return
    }

    try {
      setIsCancellingAutoTranslate(true)
      setSegmentsError(null)
      const result = await cancelAutoTranslateProject(projectId)

      if (result.project) {
        onProjectDetailChange(result.project)
      }

      setAutoTranslateProgress({
        projectId,
        phase: 'cancelled',
        completedSegments: result.project?.translatedSegmentCount ?? projectDetail?.translatedSegmentCount ?? 0,
        totalSegments: projectSegmentCount,
        progressPercent: result.project?.progressPercent ?? projectDetail?.progressPercent ?? 0,
        message: 'Auto translate was cancelled.',
        updatedAt: new Date().toISOString(),
      })
    } catch (cancelError) {
      const message =
        cancelError instanceof Error ? cancelError.message : 'Could not cancel auto translate.'
      setSegmentsError(message)
      toast.error(message)
    } finally {
      setIsCancellingAutoTranslate(false)
    }
  }

  return {
    segments,
    savedSegmentTargets,
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
    isCancellingAutoTranslate,
    selectedProviderName,
    autoTranslateProgress,
    segmentsError,
    hasPendingSegmentChanges,
    inlineTranslatingSegmentId,
    confirmingSegmentId,
    inlineTranslateProviderName,
    termFuzzyMatchThreshold,
    inlineCaretRestoreSegmentId,
    inlineCaretRestoreToken,
    confirmFocusSegmentId,
    confirmFocusToken,
    setSelectedProviderName,
    handleTargetChange,
    handleActiveSegmentChange,
    handleInlineTranslateSegment,
    handleConfirmSegment,
    handleSplitSegment,
    handleMergeSegments,
    handleSaveSegments,
    handleExportDocument,
    handleGenerateSegments,
    handleOpenAutoTranslateDialog,
    handleCloseAutoTranslateDialog,
    handleConfirmAutoTranslate,
    handleCancelAutoTranslate,
  }
}

function createSavedSegmentTargetMap(segments: ProjectSegment[]) {
  return Object.fromEntries(segments.map((segment) => [segment.id, segment.targetText]))
}
