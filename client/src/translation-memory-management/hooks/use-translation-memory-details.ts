import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type {
  LanguagesResponse,
  TranslationMemorySummary,
  TranslationMemoryTerm,
} from '../../app/types'
import {
  defaultTranslationMemoryFormValues,
  fetchLanguages,
  fetchTranslationMemory,
  fetchTranslationMemoryTerms,
  saveTranslationMemory,
  updateTranslationMemoryTerm,
} from '../api'
import type { TranslationMemoryFormValues } from '../types'

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

type UseTranslationMemoryDetailsOptions = {
  translationMemoryId?: string
}

export function useTranslationMemoryDetails({
  translationMemoryId,
}: UseTranslationMemoryDetailsOptions) {
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(fallbackLanguages)
  const [translationMemory, setTranslationMemory] = useState<TranslationMemorySummary | null>(null)
  const [formValues, setFormValues] = useState<TranslationMemoryFormValues>(defaultTranslationMemoryFormValues)
  const [terms, setTerms] = useState<TranslationMemoryTerm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingTermIds, setSavingTermIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const isReady = useMemo(() => Boolean(translationMemoryId), [translationMemoryId])

  useEffect(() => {
    if (!translationMemoryId) {
      setError('Translation memory not found.')
      setIsLoading(false)
      return
    }

    const resolvedTranslationMemoryId = translationMemoryId

    const controller = new AbortController()

    async function loadDetails() {
      try {
        setIsLoading(true)
        setError(null)
        const [languages, existingTranslationMemory, existingTerms] = await Promise.all([
          fetchLanguages(controller.signal),
          fetchTranslationMemory(resolvedTranslationMemoryId, controller.signal),
          fetchTranslationMemoryTerms(resolvedTranslationMemoryId, controller.signal),
        ])

        setLanguagesData(languages)
        setTranslationMemory(existingTranslationMemory)
        setFormValues({
          name: existingTranslationMemory.name,
          sourceLanguage: existingTranslationMemory.sourceLanguage,
          targetLanguage: existingTranslationMemory.targetLanguage,
        })
        setTerms(existingTerms)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load translation memory details.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadDetails()
    return () => controller.abort()
  }, [translationMemoryId])

  function handleFieldChange<K extends keyof TranslationMemoryFormValues>(
    field: K,
    value: TranslationMemoryFormValues[K],
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  async function handleSaveTranslationMemory() {
    if (!translationMemoryId) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const savedTranslationMemory = await saveTranslationMemory(translationMemoryId, formValues)
      setTranslationMemory(savedTranslationMemory)
      setFormValues({
        name: savedTranslationMemory.name,
        sourceLanguage: savedTranslationMemory.sourceLanguage,
        targetLanguage: savedTranslationMemory.targetLanguage,
      })
      toast.success('Translation memory updated successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save translation memory.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleTermDraftChange(
    termId: string,
    field: 'sourceTerm' | 'targetTerm',
    value: string,
  ) {
    setTerms((currentTerms) =>
      currentTerms.map((term) =>
        term.id === termId
          ? {
              ...term,
              [field]: value,
            }
          : term,
      ),
    )
  }

  async function handleTermBlur(termId: string) {
    if (!translationMemoryId) {
      return
    }

    const term = terms.find((item) => item.id === termId)
    if (!term) {
      return
    }

    const sourceTerm = term.sourceTerm.trim()
    const targetTerm = term.targetTerm.trim()
    if (!sourceTerm || !targetTerm) {
      return
    }

    setSavingTermIds((current) => [...current, termId])
    try {
      const savedTerm = await updateTranslationMemoryTerm(translationMemoryId, termId, {
        sourceTerm,
        targetTerm,
      })
      setTerms((currentTerms) =>
        currentTerms.map((item) => (item.id === termId ? savedTerm : item)),
      )
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : 'Could not update translation memory term.',
      )
    } finally {
      setSavingTermIds((current) => current.filter((currentTermId) => currentTermId !== termId))
    }
  }

  return {
    languagesData,
    translationMemory,
    formValues,
    terms,
    isReady,
    isLoading,
    isSaving,
    savingTermIds,
    error,
    handleFieldChange,
    handleSaveTranslationMemory,
    handleTermDraftChange,
    handleTermBlur,
  }
}
