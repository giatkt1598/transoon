import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type {
  GlossarySummary,
  ProjectDetail,
  ProjectGlossaryConfig,
  ProjectTranslationMemoryConfig,
  TranslationMemorySummary,
} from '../../app/types'
import {
  attachProjectGlossary,
  attachProjectTranslationMemory,
  deleteProjectGlossary,
  deleteProjectTranslationMemory,
  fetchProjectDetail,
  fetchTranslateProviders,
  fetchTranslationMemories,
  updateProjectGlossary,
  updateProjectTranslationMemory,
} from '../api'
import { fetchGlossaries } from '../../glossary-management/api'
import { saveTranslationMemory } from '../../translation-memory-management/api'
import type { TranslateProviderOption } from '../../app/types'

type TranslationMemoryConfigForm = {
  mode: 'create' | 'existing'
  translationMemoryId: string
  name: string
  accessMode: 'read' | 'write'
}

const initialConfigForm: TranslationMemoryConfigForm = {
  mode: 'create',
  translationMemoryId: '',
  name: '',
  accessMode: 'read',
}

type DraftProjectTranslationMemoryConfig = ProjectTranslationMemoryConfig & {
  isDraftNew?: boolean
}

type GlossaryConfigForm = {
  glossaryId: string
}

type UseProjectDetailOptions = {
  projectId?: string
}

export function useProjectDetail({ projectId }: UseProjectDetailOptions) {
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null)
  const [translationMemories, setTranslationMemories] = useState<TranslationMemorySummary[]>([])
  const [glossaries, setGlossaries] = useState<GlossarySummary[]>([])
  const [translateProviders, setTranslateProviders] = useState<TranslateProviderOption[]>([])
  const [draftTranslationMemories, setDraftTranslationMemories] = useState<DraftProjectTranslationMemoryConfig[]>([])
  const [draftGlossaries, setDraftGlossaries] = useState<ProjectGlossaryConfig[]>([])
  const [configForm, setConfigForm] = useState<TranslationMemoryConfigForm>(initialConfigForm)
  const [glossaryConfigForm, setGlossaryConfigForm] = useState<GlossaryConfigForm>({ glossaryId: '' })
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [isGlossaryDialogOpen, setIsGlossaryDialogOpen] = useState(false)
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [draggedTranslationMemoryId, setDraggedTranslationMemoryId] = useState<string | null>(null)
  const [draggedGlossaryId, setDraggedGlossaryId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      setError('Project not found.')
      setIsLoading(false)
      return
    }

    const resolvedProjectId = projectId
    const controller = new AbortController()

    async function loadData() {
      try {
        setIsLoading(true)
        const [project, memories, glossaryList, providersResponse] = await Promise.all([
          fetchProjectDetail(resolvedProjectId, controller.signal),
          fetchTranslationMemories(controller.signal),
          fetchGlossaries(controller.signal),
          fetchTranslateProviders(controller.signal),
        ])

        setProjectDetail(project)
        setDraftTranslationMemories(project.translationMemories)
        setDraftGlossaries(project.glossaries)
        setTranslationMemories(memories)
        setGlossaries(glossaryList)
        setTranslateProviders(providersResponse.translateProviders)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load project detail.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => controller.abort()
  }, [projectId])

  const availableTranslationMemories = useMemo(() => {
    if (!projectDetail) {
      return []
    }

    const selectedIds = new Set(draftTranslationMemories.map((item) => item.translationMemoryId))
    if (editingConfigId) {
      selectedIds.delete(editingConfigId)
    }
    return translationMemories.filter(
      (item) =>
        item.sourceLanguage === projectDetail.sourceLang &&
        item.targetLanguage === projectDetail.targetLang &&
        !selectedIds.has(item.id),
    )
  }, [draftTranslationMemories, editingConfigId, projectDetail, translationMemories])

  const availableGlossaries = useMemo(() => {
    if (!projectDetail) {
      return []
    }

    const selectedIds = new Set(draftGlossaries.map((item) => item.glossaryId))
    return glossaries.filter(
      (item) =>
        item.sourceLanguage === projectDetail.sourceLang &&
        item.targetLanguage === projectDetail.targetLang &&
        !selectedIds.has(item.id),
    )
  }, [draftGlossaries, glossaries, projectDetail])

  const hasPendingTranslationMemoryChanges = useMemo(() => {
    if (!projectDetail) {
      return false
    }

    const original = [...projectDetail.translationMemories]
      .sort((left, right) => left.priority - right.priority)
      .map((item) => ({
        translationMemoryId: item.translationMemoryId,
        name: item.name,
        accessMode: item.accessMode,
        priority: item.priority,
      }))
    const draft = [...draftTranslationMemories]
      .sort((left, right) => left.priority - right.priority)
      .map((item) => ({
        translationMemoryId: item.translationMemoryId,
        name: item.name,
        accessMode: item.accessMode,
        priority: item.priority,
      }))

    return JSON.stringify(original) !== JSON.stringify(draft)
  }, [draftTranslationMemories, projectDetail])

  const hasPendingGlossaryChanges = useMemo(() => {
    if (!projectDetail) {
      return false
    }

    const original = [...projectDetail.glossaries]
      .sort((left, right) => left.priority - right.priority)
      .map((item) => ({
        glossaryId: item.glossaryId,
        priority: item.priority,
      }))
    const draft = [...draftGlossaries]
      .sort((left, right) => left.priority - right.priority)
      .map((item) => ({
        glossaryId: item.glossaryId,
        priority: item.priority,
      }))

    return JSON.stringify(original) !== JSON.stringify(draft)
  }, [draftGlossaries, projectDetail])

  function handleTabChange(_event: React.SyntheticEvent, value: number) {
    setActiveTab(value)
  }

  function handleConfigFieldChange<K extends keyof TranslationMemoryConfigForm>(
    field: K,
    value: TranslationMemoryConfigForm[K],
  ) {
    setConfigForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleOpenAddDialog() {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }
    setEditingConfigId(null)
    setConfigForm(initialConfigForm)
    setIsConfigDialogOpen(true)
  }

  function handleOpenEditDialog(translationMemoryId: string) {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }
    const existingConfig = draftTranslationMemories.find((item) => item.translationMemoryId === translationMemoryId)
    if (!existingConfig) {
      return
    }

    setEditingConfigId(translationMemoryId)
    setConfigForm({
      mode: 'existing',
      translationMemoryId,
      name: existingConfig.name,
      accessMode: existingConfig.accessMode,
    })
    setIsConfigDialogOpen(true)
  }

  function handleCloseConfigDialog() {
    setIsConfigDialogOpen(false)
    setEditingConfigId(null)
    setConfigForm(initialConfigForm)
  }

  function handleGlossaryConfigFieldChange<K extends keyof GlossaryConfigForm>(
    field: K,
    value: GlossaryConfigForm[K],
  ) {
    setGlossaryConfigForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleOpenAddGlossaryDialog() {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }
    setGlossaryConfigForm({ glossaryId: '' })
    setIsGlossaryDialogOpen(true)
  }

  function handleCloseGlossaryDialog() {
    setIsGlossaryDialogOpen(false)
    setGlossaryConfigForm({ glossaryId: '' })
  }

  function handleAddGlossary() {
    const selectedGlossary = availableGlossaries.find(
      (item) => item.id === glossaryConfigForm.glossaryId,
    )
    if (!selectedGlossary) {
      return
    }

    setDraftGlossaries((current) => [
      ...current,
      {
        ...selectedGlossary,
        projectId: projectId ?? '',
        glossaryId: selectedGlossary.id,
        linkedAt: new Date().toISOString(),
        priority: current.length,
      },
    ])
    handleCloseGlossaryDialog()
  }

  function handleAddTranslationMemory() {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }

    if (editingConfigId) {
      setDraftTranslationMemories((current) =>
        applySingleWriteRule(
          current.map((item) =>
            item.translationMemoryId === editingConfigId
              ? {
                  ...item,
                  accessMode: configForm.accessMode,
                }
              : item,
          ),
          configForm.accessMode === 'write' ? editingConfigId : null,
        ),
      )
    } else {
      setDraftTranslationMemories((current) => {
        const nextItem = createDraftTranslationMemoryConfig({
          projectId: projectId ?? '',
          configForm,
          nextPriority: current.length,
          availableTranslationMemories,
          projectDetail,
        })

        if (!nextItem) {
          return current
        }

        return applySingleWriteRule(
          [...current, nextItem],
          nextItem.accessMode === 'write' ? nextItem.translationMemoryId : null,
        )
      })
    }

    handleCloseConfigDialog()
  }

  async function handleDeleteConfig(translationMemoryId: string) {
    if (!projectDetail || projectDetail.status === 'auto-translate-processing') {
      return
    }

    const config = draftTranslationMemories.find((item) => item.translationMemoryId === translationMemoryId)
    const shouldDelete = window.confirm(
      `Remove "${config?.name ?? 'this translation memory'}" from the project?`,
    )

    if (!shouldDelete) {
      return
    }

    setDraftTranslationMemories((current) =>
      current
        .filter((item) => item.translationMemoryId !== translationMemoryId)
        .map((item, index) => ({
          ...item,
          priority: index,
        })),
    )
  }

  async function handleDeleteGlossaryConfig(glossaryId: string) {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }

    const config = draftGlossaries.find((item) => item.glossaryId === glossaryId)
    const shouldDelete = window.confirm(
      `Remove "${config?.name ?? 'this glossary'}" from the project?`,
    )
    if (!shouldDelete) {
      return
    }

    setDraftGlossaries((current) =>
      current
        .filter((item) => item.glossaryId !== glossaryId)
        .map((item, index) => ({
          ...item,
          priority: index,
        })),
    )
  }

  function handleAccessModeChange(translationMemoryId: string, accessMode: 'read' | 'write') {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }

    setDraftTranslationMemories((current) =>
      applySingleWriteRule(
        current.map((item) =>
          item.translationMemoryId === translationMemoryId ? { ...item, accessMode } : item,
        ),
        accessMode === 'write' ? translationMemoryId : null,
      ),
    )
  }

  function handleDragStart(translationMemoryId: string) {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }
    setDraggedTranslationMemoryId(translationMemoryId)
  }

  function handleDragEnd() {
    setDraggedTranslationMemoryId(null)
  }

  function handleGlossaryDragStart(glossaryId: string) {
    if (projectDetail?.status === 'auto-translate-processing') {
      return
    }
    setDraggedGlossaryId(glossaryId)
  }

  function handleGlossaryDragEnd() {
    setDraggedGlossaryId(null)
  }

  function handleDropOnRow(targetTranslationMemoryId: string) {
    if (projectDetail?.status === 'auto-translate-processing') {
      setDraggedTranslationMemoryId(null)
      return
    }

    if (!draggedTranslationMemoryId || draggedTranslationMemoryId === targetTranslationMemoryId) {
      setDraggedTranslationMemoryId(null)
      return
    }

    setDraftTranslationMemories((current) => {
      const draggedIndex = current.findIndex((item) => item.translationMemoryId === draggedTranslationMemoryId)
      const targetIndex = current.findIndex((item) => item.translationMemoryId === targetTranslationMemoryId)

      if (draggedIndex < 0 || targetIndex < 0) {
        return current
      }

      const nextItems = [...current]
      const [draggedItem] = nextItems.splice(draggedIndex, 1)
      nextItems.splice(targetIndex, 0, draggedItem)

      return nextItems.map((item, index) => ({
        ...item,
        priority: index,
      }))
    })
    setDraggedTranslationMemoryId(null)
  }

  function handleDropGlossaryOnRow(targetGlossaryId: string) {
    if (projectDetail?.status === 'auto-translate-processing') {
      setDraggedGlossaryId(null)
      return
    }

    if (!draggedGlossaryId || draggedGlossaryId === targetGlossaryId) {
      setDraggedGlossaryId(null)
      return
    }

    setDraftGlossaries((current) => {
      const draggedIndex = current.findIndex((item) => item.glossaryId === draggedGlossaryId)
      const targetIndex = current.findIndex((item) => item.glossaryId === targetGlossaryId)
      if (draggedIndex < 0 || targetIndex < 0) {
        return current
      }

      const nextItems = [...current]
      const [draggedItem] = nextItems.splice(draggedIndex, 1)
      nextItems.splice(targetIndex, 0, draggedItem)

      return nextItems.map((item, index) => ({
        ...item,
        priority: index,
      }))
    })
    setDraggedGlossaryId(null)
  }

  async function handleSaveTranslationMemories() {
    if (!projectId || !projectDetail) {
      return
    }

    if (projectDetail.status === 'auto-translate-processing') {
      setError('This project is currently running auto translate. Manual changes are temporarily disabled.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const originalItems = projectDetail.translationMemories
      const draftItems = draftTranslationMemories

      const originalMap = new Map(originalItems.map((item) => [item.translationMemoryId, item]))
      const draftMap = new Map(draftItems.map((item) => [item.translationMemoryId, item]))

      const removedIds = originalItems
        .filter((item) => !draftMap.has(item.translationMemoryId))
        .map((item) => item.translationMemoryId)

      for (const translationMemoryId of removedIds) {
        await deleteProjectTranslationMemory(projectId, translationMemoryId)
      }

      const originalWrite = originalItems.find((item) => item.accessMode === 'write')
      const draftWrite = draftItems.find((item) => item.accessMode === 'write')

      if (
        originalWrite &&
        (!draftWrite || draftWrite.translationMemoryId !== originalWrite.translationMemoryId) &&
        draftMap.has(originalWrite.translationMemoryId)
      ) {
        await updateProjectTranslationMemory(projectId, originalWrite.translationMemoryId, {
          accessMode: 'read',
          priority: draftMap.get(originalWrite.translationMemoryId)?.priority ?? originalWrite.priority,
        })
      }

      const newReadItems = draftItems.filter(
        (item) =>
          !originalMap.has(item.translationMemoryId) &&
          item.accessMode === 'read' &&
          !item.isDraftNew,
      )
      const newWriteItem = draftItems.find(
        (item) =>
          !originalMap.has(item.translationMemoryId) &&
          item.accessMode === 'write' &&
          !item.isDraftNew,
      )
      const newDraftItems = draftItems.filter(
        (item) => !originalMap.has(item.translationMemoryId) && item.isDraftNew,
      )

      for (const item of newReadItems) {
        await attachProjectTranslationMemory(projectId, {
          translationMemoryId: item.translationMemoryId,
          accessMode: item.accessMode,
          priority: item.priority,
        })
      }

      const existingReadUpdates = draftItems.filter((item) => {
        const originalItem = originalMap.get(item.translationMemoryId)
        return (
          originalItem &&
          item.accessMode === 'read' &&
          (item.accessMode !== originalItem.accessMode || item.priority !== originalItem.priority)
        )
      })

      for (const item of existingReadUpdates) {
        await updateProjectTranslationMemory(projectId, item.translationMemoryId, {
          accessMode: item.accessMode,
          priority: item.priority,
        })
      }

      if (newWriteItem) {
        await attachProjectTranslationMemory(projectId, {
          translationMemoryId: newWriteItem.translationMemoryId,
          accessMode: newWriteItem.accessMode,
          priority: newWriteItem.priority,
        })
      }

      for (const item of newDraftItems) {
        const createdTranslationMemory = await saveTranslationMemory(null, {
          name: item.name,
          sourceLanguage: projectDetail.sourceLang,
          targetLanguage: projectDetail.targetLang,
        })

        await attachProjectTranslationMemory(projectId, {
          translationMemoryId: createdTranslationMemory.id,
          accessMode: item.accessMode,
          priority: item.priority,
        })
      }

      const existingWriteItem = draftWrite && originalMap.has(draftWrite.translationMemoryId) ? draftWrite : null
      if (existingWriteItem) {
        const originalItem = originalMap.get(existingWriteItem.translationMemoryId)
        if (
          originalItem &&
          (existingWriteItem.accessMode !== originalItem.accessMode || existingWriteItem.priority !== originalItem.priority)
        ) {
          await updateProjectTranslationMemory(projectId, existingWriteItem.translationMemoryId, {
            accessMode: existingWriteItem.accessMode,
            priority: existingWriteItem.priority,
          })
        }
      }

      const [nextProjectDetail, nextTranslationMemories] = await Promise.all([
        fetchProjectDetail(projectId),
        fetchTranslationMemories(),
      ])

      setProjectDetail(nextProjectDetail)
      setDraftTranslationMemories(nextProjectDetail.translationMemories)
      setTranslationMemories(nextTranslationMemories)
      toast.success('Project translation memories saved successfully.')
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Could not save project translation memories.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveGlossaries() {
    if (!projectId || !projectDetail) {
      return
    }

    if (projectDetail.status === 'auto-translate-processing') {
      setError('This project is currently running auto translate. Manual changes are temporarily disabled.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const originalItems = projectDetail.glossaries
      const draftItems = draftGlossaries

      const originalMap = new Map(originalItems.map((item) => [item.glossaryId, item]))
      const draftMap = new Map(draftItems.map((item) => [item.glossaryId, item]))

      const removedIds = originalItems
        .filter((item) => !draftMap.has(item.glossaryId))
        .map((item) => item.glossaryId)

      for (const glossaryId of removedIds) {
        await deleteProjectGlossary(projectId, glossaryId)
      }

      const newItems = draftItems.filter((item) => !originalMap.has(item.glossaryId))
      for (const item of newItems) {
        await attachProjectGlossary(projectId, {
          glossaryId: item.glossaryId,
          priority: item.priority,
        })
      }

      const updatedItems = draftItems.filter((item) => {
        const originalItem = originalMap.get(item.glossaryId)
        return originalItem && item.priority !== originalItem.priority
      })

      for (const item of updatedItems) {
        await updateProjectGlossary(projectId, item.glossaryId, {
          priority: item.priority,
        })
      }

      const [nextProjectDetail, nextGlossaries] = await Promise.all([
        fetchProjectDetail(projectId),
        fetchGlossaries(),
      ])

      setProjectDetail(nextProjectDetail)
      setDraftGlossaries(nextProjectDetail.glossaries)
      setGlossaries(nextGlossaries)
      toast.success('Project glossaries saved successfully.')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not save project glossaries.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return {
    projectDetail,
    setProjectDetail,
    translationMemories,
    glossaries,
    translateProviders,
    availableTranslationMemories,
    availableGlossaries,
    draftTranslationMemories,
    draftGlossaries,
    hasPendingTranslationMemoryChanges,
    hasPendingGlossaryChanges,
    configForm,
    glossaryConfigForm,
    isConfigDialogOpen,
    isGlossaryDialogOpen,
    editingConfigId,
    draggedTranslationMemoryId,
    draggedGlossaryId,
    activeTab,
    isLoading,
    isSaving,
    error,
    handleTabChange,
    handleConfigFieldChange,
    handleGlossaryConfigFieldChange,
    handleOpenAddDialog,
    handleOpenAddGlossaryDialog,
    handleOpenEditDialog,
    handleCloseConfigDialog,
    handleCloseGlossaryDialog,
    handleAddTranslationMemory,
    handleAddGlossary,
    handleDeleteConfig,
    handleDeleteGlossaryConfig,
    handleAccessModeChange,
    handleDragStart,
    handleDragEnd,
    handleDropOnRow,
    handleGlossaryDragStart,
    handleGlossaryDragEnd,
    handleDropGlossaryOnRow,
    handleSaveTranslationMemories,
    handleSaveGlossaries,
  }
}

function applySingleWriteRule(
  items: ProjectTranslationMemoryConfig[],
  preferredWriteId: string | null = null,
) {
  const writeIndex = preferredWriteId
    ? items.findIndex((item) => item.translationMemoryId === preferredWriteId)
    : items.findIndex((item) => item.accessMode === 'write')
  if (writeIndex < 0) {
    return items
  }

  return items.map((item, index): ProjectTranslationMemoryConfig => ({
    ...item,
    accessMode: index === writeIndex ? 'write' : 'read',
  }))
}

function createDraftTranslationMemoryConfig({
  projectId,
  configForm,
  nextPriority,
  availableTranslationMemories,
  projectDetail,
}: {
  projectId: string
  configForm: TranslationMemoryConfigForm
  nextPriority: number
  availableTranslationMemories: TranslationMemorySummary[]
  projectDetail: ProjectDetail | null
}): DraftProjectTranslationMemoryConfig | null {
  if (configForm.mode === 'existing') {
    if (!configForm.translationMemoryId) {
      return null
    }

    const selectedTranslationMemory = availableTranslationMemories.find(
      (item) => item.id === configForm.translationMemoryId,
    )
    if (!selectedTranslationMemory) {
      return null
    }

    return {
      ...selectedTranslationMemory,
      projectId,
      translationMemoryId: selectedTranslationMemory.id,
      accessMode: configForm.accessMode,
      priority: nextPriority,
      linkedAt: new Date().toISOString(),
    }
  }

  if (!projectDetail || !configForm.name.trim()) {
    return null
  }

  const draftId = `draft:new:${crypto.randomUUID()}`
  return {
    id: draftId,
    projectId,
    translationMemoryId: draftId,
    name: configForm.name.trim(),
    sourceLanguage: projectDetail.sourceLang,
    targetLanguage: projectDetail.targetLang,
    lastModifiedAt: new Date().toISOString(),
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    termCount: 0,
    accessMode: configForm.accessMode,
    priority: nextPriority,
    linkedAt: new Date().toISOString(),
    isDraftNew: true,
  }
}
