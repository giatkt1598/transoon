import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { GlossaryItem, GlossarySummary, LanguagesResponse } from '../../app/types'
import {
  createGlossaryItem,
  defaultGlossaryFormValues,
  deleteGlossaryItem,
  fetchGlossary,
  fetchGlossaryItems,
  fetchLanguages,
  saveGlossary,
  updateGlossaryItem,
} from '../api'
import type { GlossaryFormValues, GlossaryItemDraft } from '../types'

const fallbackLanguages: LanguagesResponse = {
  defaultSourceLanguage: 'en',
  defaultTargetLanguage: 'ja',
  languages: [
    { code: 'auto', label: 'Auto detect' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: 'Japanese' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'zh-CN', label: 'Chinese (Simplified)' },
    { code: 'ko', label: 'Korean' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'es', label: 'Spanish' },
  ],
}

const defaultNewGlossaryItem: GlossaryItemDraft = {
  source: '',
  target: '',
  caseSensitive: false,
  wholeWord: true,
  priority: 0,
}

type UseGlossaryDetailsOptions = {
  glossaryId?: string
}

export function useGlossaryDetails({ glossaryId }: UseGlossaryDetailsOptions) {
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(fallbackLanguages)
  const [glossary, setGlossary] = useState<GlossarySummary | null>(null)
  const [formValues, setFormValues] = useState<GlossaryFormValues>(defaultGlossaryFormValues)
  const [savedFormValues, setSavedFormValues] = useState<GlossaryFormValues>(defaultGlossaryFormValues)
  const [items, setItems] = useState<GlossaryItem[]>([])
  const [savedItems, setSavedItems] = useState<GlossaryItem[]>([])
  const [newItemDraft, setNewItemDraft] = useState<GlossaryItemDraft>(defaultNewGlossaryItem)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReady = useMemo(() => Boolean(glossaryId), [glossaryId])

  useEffect(() => {
    if (!glossaryId) {
      setError('Glossary not found.')
      setIsLoading(false)
      return
    }

    const resolvedGlossaryId = glossaryId
    const controller = new AbortController()

    async function loadDetails() {
      try {
        setIsLoading(true)
        setError(null)
        const [languages, existingGlossary, existingItems] = await Promise.all([
          fetchLanguages(controller.signal),
          fetchGlossary(resolvedGlossaryId, controller.signal),
          fetchGlossaryItems(resolvedGlossaryId, controller.signal),
        ])

        setLanguagesData(languages)
        setGlossary(existingGlossary)
        setFormValues({
          name: existingGlossary.name,
          sourceLanguage: existingGlossary.sourceLanguage,
          targetLanguage: existingGlossary.targetLanguage,
        })
        setSavedFormValues({
          name: existingGlossary.name,
          sourceLanguage: existingGlossary.sourceLanguage,
          targetLanguage: existingGlossary.targetLanguage,
        })
        setItems(existingItems)
        setSavedItems(existingItems)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load glossary details.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadDetails()
    return () => controller.abort()
  }, [glossaryId])

  function handleFieldChange<K extends keyof GlossaryFormValues>(field: K, value: GlossaryFormValues[K]) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const hasPendingChanges = useMemo(() => {
    return (
      JSON.stringify(formValues) !== JSON.stringify(savedFormValues) ||
      JSON.stringify(serializeGlossaryItems(items)) !== JSON.stringify(serializeGlossaryItems(savedItems))
    )
  }, [formValues, items, savedFormValues, savedItems])

  async function handleSaveGlossary() {
    if (!glossaryId) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      const savedGlossary = await saveGlossary(glossaryId, formValues)
      const savedCurrentItems = await persistGlossaryItems(glossaryId, savedItems, items)
      setGlossary(savedGlossary)
      setSavedFormValues({
        name: savedGlossary.name,
        sourceLanguage: savedGlossary.sourceLanguage,
        targetLanguage: savedGlossary.targetLanguage,
      })
      setItems(savedCurrentItems)
      setSavedItems(savedCurrentItems)
      toast.success('Glossary updated successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save glossary.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleGlossaryItemDraftChange(
    glossaryItemId: string,
    field: keyof GlossaryItemDraft,
    value: string | number | boolean,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === glossaryItemId ? { ...item, [field]: value } : item)),
    )
  }

  async function handleGlossaryItemBlur(glossaryItemId: string) {
    const glossaryItem = items.find((item) => item.id === glossaryItemId)
    if (!glossaryItem) {
      return
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === glossaryItemId
          ? {
              ...item,
              source: item.source.trim(),
              target: item.target.trim(),
            }
          : item,
      ),
    )
  }

  function handleNewItemDraftChange<K extends keyof GlossaryItemDraft>(field: K, value: GlossaryItemDraft[K]) {
    setNewItemDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateGlossaryItem() {
    try {
      const currentCaseSensitive = newItemDraft.caseSensitive
      const source = newItemDraft.source.trim()
      const target = newItemDraft.target.trim()
      if (!source || !target) {
        toast.error('Glossary items require both source and target text.')
        return
      }

      const now = new Date().toISOString()
      const createdItem: GlossaryItem = {
        id: `draft:${crypto.randomUUID()}`,
        glossaryId: glossaryId ?? '',
        source,
        sourceNormalized: normalizeGlossaryText(source),
        target,
        targetNormalized: normalizeGlossaryText(target),
        caseSensitive: newItemDraft.caseSensitive ? 1 : 0,
        wholeWord: 1,
        priority: newItemDraft.priority,
        lastModifiedAt: now,
        lastUsedAt: null,
        createdAt: now,
      }

      setItems((currentItems) => [createdItem, ...currentItems])
      setNewItemDraft({
        ...defaultNewGlossaryItem,
        caseSensitive: currentCaseSensitive,
      })
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Could not stage glossary item.')
    }
  }

  async function handleDeleteGlossaryItem(glossaryItemId: string) {
    try {
      setItems((currentItems) => currentItems.filter((item) => item.id !== glossaryItemId))
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not remove glossary item.')
    }
  }

  return {
    languagesData,
    glossary,
    formValues,
    items,
    newItemDraft,
    isReady,
    isLoading,
    isSaving,
    hasPendingChanges,
    error,
    handleFieldChange,
    handleSaveGlossary,
    handleGlossaryItemDraftChange,
    handleGlossaryItemBlur,
    handleNewItemDraftChange,
    handleCreateGlossaryItem,
    handleDeleteGlossaryItem,
  }
}

async function persistGlossaryItems(
  glossaryId: string,
  originalItems: GlossaryItem[],
  draftItems: GlossaryItem[],
) {
  const originalIds = new Set(originalItems.map((item) => item.id))
  const draftIds = new Set(draftItems.map((item) => item.id))

  const removedItems = originalItems.filter((item) => !draftIds.has(item.id))
  for (const item of removedItems) {
    await deleteGlossaryItem(glossaryId, item.id)
  }

  const persistedItems: GlossaryItem[] = []

  for (const item of draftItems) {
    const source = item.source.trim()
    const target = item.target.trim()

    if (!source || !target) {
      continue
    }

    if (item.id.startsWith('draft:') || !originalIds.has(item.id)) {
      const createdItem = await createGlossaryItem(glossaryId, {
        source,
        target,
        caseSensitive: item.caseSensitive === 1,
        wholeWord: true,
        priority: item.priority,
      })
      persistedItems.push(createdItem)
      continue
    }

    const savedItem = await updateGlossaryItem(glossaryId, item.id, {
      source,
      target,
      caseSensitive: item.caseSensitive === 1,
      wholeWord: true,
      priority: item.priority,
    })

    if (savedItem) {
      persistedItems.push(savedItem)
    }
  }

  return persistedItems
}

function serializeGlossaryItems(items: GlossaryItem[]) {
  return items.map((item) => ({
    id: item.id,
    source: item.source.trim(),
    target: item.target.trim(),
    caseSensitive: item.caseSensitive,
    wholeWord: item.wholeWord,
    priority: item.priority,
  }))
}

function normalizeGlossaryText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}
