import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { GlossarySummary, LanguagesResponse } from '../../app/types'
import { defaultGlossaryFormValues, fetchGlossary, fetchLanguages, saveGlossary } from '../api'
import type { GlossaryFormValues } from '../types'

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

type UseGlossaryEditorOptions = {
  glossaryId?: string
}

export function useGlossaryEditor({ glossaryId }: UseGlossaryEditorOptions) {
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(fallbackLanguages)
  const [glossary, setGlossary] = useState<GlossarySummary | null>(null)
  const [formValues, setFormValues] = useState<GlossaryFormValues>(defaultGlossaryFormValues)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditMode = useMemo(() => Boolean(glossaryId), [glossaryId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadEditorData() {
      try {
        setIsLoading(true)
        setError(null)
        const languages = await fetchLanguages(controller.signal)
        setLanguagesData(languages)

        if (!glossaryId) {
          setFormValues({
            ...defaultGlossaryFormValues,
            sourceLanguage: languages.defaultSourceLanguage,
            targetLanguage: languages.defaultTargetLanguage,
          })
          return
        }

        const existingGlossary = await fetchGlossary(glossaryId, controller.signal)
        setGlossary(existingGlossary)
        setFormValues({
          name: existingGlossary.name,
          sourceLanguage: existingGlossary.sourceLanguage,
          targetLanguage: existingGlossary.targetLanguage,
        })
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load glossary editor.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadEditorData()
    return () => controller.abort()
  }, [glossaryId])

  function handleFieldChange<K extends keyof GlossaryFormValues>(field: K, value: GlossaryFormValues[K]) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSaveGlossary() {
    try {
      setIsSaving(true)
      setError(null)
      const savedGlossary = await saveGlossary(glossaryId ?? null, formValues)
      setGlossary(savedGlossary)
      toast.success(isEditMode ? 'Glossary updated successfully.' : 'Glossary created successfully.')

      if (!glossaryId) {
        window.location.href = `/glossaries/${savedGlossary.id}`
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save glossary.')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    languagesData,
    glossary,
    formValues,
    isEditMode,
    isLoading,
    isSaving,
    error,
    handleFieldChange,
    handleSaveGlossary,
  }
}
