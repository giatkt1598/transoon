import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { ProjectDetail, ProjectTranslationMemoryConfig, TranslationMemorySummary } from '../../app/types'
import {
  attachProjectTranslationMemory,
  deleteProjectTranslationMemory,
  fetchProjectDetail,
  fetchTranslationMemories,
  updateProjectTranslationMemory,
} from '../api'
import { saveTranslationMemory } from '../../translation-memory-management/api'

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

type UseProjectDetailOptions = {
  projectId?: string
}

export function useProjectDetail({ projectId }: UseProjectDetailOptions) {
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null)
  const [translationMemories, setTranslationMemories] = useState<TranslationMemorySummary[]>([])
  const [draftTranslationMemories, setDraftTranslationMemories] = useState<DraftProjectTranslationMemoryConfig[]>([])
  const [configForm, setConfigForm] = useState<TranslationMemoryConfigForm>(initialConfigForm)
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [draggedTranslationMemoryId, setDraggedTranslationMemoryId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
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
        const [project, memories] = await Promise.all([
          fetchProjectDetail(resolvedProjectId, controller.signal),
          fetchTranslationMemories(controller.signal),
        ])

        setProjectDetail(project)
        setDraftTranslationMemories(project.translationMemories)
        setTranslationMemories(memories)
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
        isDraftNew: item.isDraftNew ?? false,
      }))

    return JSON.stringify(original) !== JSON.stringify(draft)
  }, [draftTranslationMemories, projectDetail])

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
    setEditingConfigId(null)
    setConfigForm(initialConfigForm)
    setIsConfigDialogOpen(true)
  }

  function handleOpenEditDialog(translationMemoryId: string) {
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

  function handleAddTranslationMemory() {
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
    if (!projectDetail) {
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

  function handleAccessModeChange(translationMemoryId: string, accessMode: 'read' | 'write') {
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
    setDraggedTranslationMemoryId(translationMemoryId)
  }

  function handleDragEnd() {
    setDraggedTranslationMemoryId(null)
  }

  function handleDropOnRow(targetTranslationMemoryId: string) {
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

  async function handleSaveTranslationMemories() {
    if (!projectId || !projectDetail) {
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

  return {
    projectDetail,
    setProjectDetail,
    translationMemories,
    availableTranslationMemories,
    draftTranslationMemories,
    hasPendingTranslationMemoryChanges,
    configForm,
    isConfigDialogOpen,
    editingConfigId,
    draggedTranslationMemoryId,
    activeTab,
    isLoading,
    isSaving,
    error,
    handleTabChange,
    handleConfigFieldChange,
    handleOpenAddDialog,
    handleOpenEditDialog,
    handleCloseConfigDialog,
    handleAddTranslationMemory,
    handleDeleteConfig,
    handleAccessModeChange,
    handleDragStart,
    handleDragEnd,
    handleDropOnRow,
    handleSaveTranslationMemories,
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
