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
  const [items, setItems] = useState<GlossaryItem[]>([])
  const [newItemDraft, setNewItemDraft] = useState<GlossaryItemDraft>(defaultNewGlossaryItem)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingItemIds, setSavingItemIds] = useState<string[]>([])
  const [deletingItemIds, setDeletingItemIds] = useState<string[]>([])
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
        setItems(existingItems)
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

  async function handleSaveGlossary() {
    if (!glossaryId) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      const savedGlossary = await saveGlossary(glossaryId, formValues)
      setGlossary(savedGlossary)
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
    if (!glossaryId) {
      return
    }

    const glossaryItem = items.find((item) => item.id === glossaryItemId)
    if (!glossaryItem || !glossaryItem.source.trim() || !glossaryItem.target.trim()) {
      return
    }

    try {
      setSavingItemIds((current) => [...current, glossaryItemId])
      const savedItem = await updateGlossaryItem(glossaryId, glossaryItemId, {
        source: glossaryItem.source,
        target: glossaryItem.target,
        caseSensitive: glossaryItem.caseSensitive === 1,
        wholeWord: glossaryItem.wholeWord === 1,
        priority: glossaryItem.priority,
      })
      setItems((currentItems) => currentItems.map((item) => (item.id === glossaryItemId ? savedItem : item)))
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not update glossary item.')
    } finally {
      setSavingItemIds((current) => current.filter((itemId) => itemId !== glossaryItemId))
    }
  }

  function handleNewItemDraftChange<K extends keyof GlossaryItemDraft>(field: K, value: GlossaryItemDraft[K]) {
    setNewItemDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateGlossaryItem() {
    if (!glossaryId) {
      return
    }

    try {
      const createdItem = await createGlossaryItem(glossaryId, newItemDraft)
      setItems((currentItems) => [createdItem, ...currentItems])
      setNewItemDraft(defaultNewGlossaryItem)
      toast.success('Glossary item created successfully.')
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Could not create glossary item.')
    }
  }

  async function handleDeleteGlossaryItem(glossaryItemId: string) {
    if (!glossaryId) {
      return
    }

    try {
      setDeletingItemIds((current) => [...current, glossaryItemId])
      await deleteGlossaryItem(glossaryId, glossaryItemId)
      setItems((currentItems) => currentItems.filter((item) => item.id !== glossaryItemId))
      toast.success('Glossary item deleted successfully.')
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete glossary item.')
    } finally {
      setDeletingItemIds((current) => current.filter((itemId) => itemId !== glossaryItemId))
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
    savingItemIds,
    deletingItemIds,
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
