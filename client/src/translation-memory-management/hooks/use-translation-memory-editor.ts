import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import type { LanguagesResponse, TranslationMemorySummary } from '../../app/types'
import {
  defaultTranslationMemoryFormValues,
  fetchLanguages,
  fetchTranslationMemory,
  saveTranslationMemory,
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

type UseTranslationMemoryEditorOptions = {
  translationMemoryId?: string
}

export function useTranslationMemoryEditor({
  translationMemoryId,
}: UseTranslationMemoryEditorOptions) {
  const navigate = useNavigate()
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(fallbackLanguages)
  const [translationMemory, setTranslationMemory] = useState<TranslationMemorySummary | null>(null)
  const [formValues, setFormValues] = useState<TranslationMemoryFormValues>(defaultTranslationMemoryFormValues)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = useMemo(() => Boolean(translationMemoryId), [translationMemoryId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadEditorData() {
      try {
        setIsLoading(true)
        const [languages, existingTranslationMemory] = await Promise.all([
          fetchLanguages(controller.signal),
          translationMemoryId
            ? fetchTranslationMemory(translationMemoryId, controller.signal)
            : Promise.resolve(null),
        ])

        setLanguagesData(languages)
        setTranslationMemory(existingTranslationMemory)
        setFormValues(
          existingTranslationMemory
            ? {
                name: existingTranslationMemory.name,
                sourceLanguage: existingTranslationMemory.sourceLanguage,
                targetLanguage: existingTranslationMemory.targetLanguage,
              }
            : {
                name: '',
                sourceLanguage: languages.defaultSourceLanguage,
                targetLanguage: languages.defaultTargetLanguage,
              },
        )
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load translation memory editor.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadEditorData()

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
    setIsSaving(true)
    setError(null)

    try {
      const savedTranslationMemory = await saveTranslationMemory(translationMemoryId ?? null, formValues)
      toast.success(
        translationMemoryId
          ? 'Translation memory updated successfully.'
          : 'Translation memory created successfully.',
      )
      setTranslationMemory(savedTranslationMemory)
      setFormValues({
        name: savedTranslationMemory.name,
        sourceLanguage: savedTranslationMemory.sourceLanguage,
        targetLanguage: savedTranslationMemory.targetLanguage,
      })
      navigate(-1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save translation memory.')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    languagesData,
    translationMemory,
    formValues,
    isEditMode,
    isLoading,
    isSaving,
    error,
    handleFieldChange,
    handleSaveTranslationMemory,
  }
}
