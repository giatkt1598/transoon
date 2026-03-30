import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import type { AppSettings, TranslateProviderOption } from '../../app/types'
import { fetchSettings, fetchTranslateProviders, saveSettings } from '../api'

type SettingsFormValues = AppSettings
const SETTINGS_AUTO_SAVE_DELAY_MS = 150

export function useSettingsPage() {
  const [translateProviders, setTranslateProviders] = useState<TranslateProviderOption[]>([])
  const [formValues, setFormValues] = useState<SettingsFormValues>({
    inlineTranslateProvider: null,
    termFuzzyMatchThreshold: 0.9,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFormValues, setSavedFormValues] = useState<SettingsFormValues>({
    inlineTranslateProvider: null,
    termFuzzyMatchThreshold: 0.9,
  })
  const autoSaveTimeoutRef = useRef<number | null>(null)
  const latestSaveRequestIdRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSettingsPage() {
      try {
        setIsLoading(true)
        const [providersResponse, settings] = await Promise.all([
          fetchTranslateProviders(controller.signal),
          fetchSettings(controller.signal),
        ])

        const resolvedInlineTranslateProvider =
          settings.inlineTranslateProvider &&
          providersResponse.translateProviders.some(
            (provider) => provider.name === settings.inlineTranslateProvider,
          )
            ? settings.inlineTranslateProvider
            : null

        setTranslateProviders(providersResponse.translateProviders)
        const nextFormValues = {
          inlineTranslateProvider: resolvedInlineTranslateProvider,
          termFuzzyMatchThreshold: settings.termFuzzyMatchThreshold,
        }
        setFormValues(nextFormValues)
        setSavedFormValues(nextFormValues)
        setError(null)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load settings.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadSettingsPage()

    return () => controller.abort()
  }, [])

  const selectedProvider = useMemo(
    () =>
      translateProviders.find((provider) => provider.name === formValues.inlineTranslateProvider) ??
      null,
    [formValues.inlineTranslateProvider, translateProviders],
  )
  const hasPendingChanges = useMemo(
    () =>
      formValues.inlineTranslateProvider !== savedFormValues.inlineTranslateProvider ||
      formValues.termFuzzyMatchThreshold !== savedFormValues.termFuzzyMatchThreshold,
    [formValues, savedFormValues],
  )

  function handleInlineTranslateProviderChange(value: string | null) {
    setError(null)
    setFormValues((currentValues) => ({
      ...currentValues,
      inlineTranslateProvider: value,
    }))
  }

  function handleTermFuzzyMatchThresholdChange(value: number) {
    setError(null)
    setFormValues((currentValues) => ({
      ...currentValues,
      termFuzzyMatchThreshold: value,
    }))
  }

  async function persistSettings(nextFormValues: SettingsFormValues) {
    const requestId = Date.now()
    latestSaveRequestIdRef.current = requestId
    setIsSaving(true)
    setError(null)

    try {
      const savedSettings = await saveSettings(nextFormValues)
      if (latestSaveRequestIdRef.current !== requestId) {
        return
      }
      setFormValues(savedSettings)
      setSavedFormValues(savedSettings)
    } catch (saveError) {
      if (latestSaveRequestIdRef.current !== requestId) {
        return
      }
      const message = saveError instanceof Error ? saveError.message : 'Could not save settings.'
      setError(message)
      toast.error(message)
    } finally {
      if (latestSaveRequestIdRef.current === requestId) {
        setIsSaving(false)
      }
    }
  }

  useEffect(() => {
    if (isLoading || !translateProviders.length || !hasPendingChanges) {
      return
    }

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      autoSaveTimeoutRef.current = null
      void persistSettings(formValues)
    }, SETTINGS_AUTO_SAVE_DELAY_MS)

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current)
        autoSaveTimeoutRef.current = null
      }
    }
  }, [formValues, hasPendingChanges, isLoading, translateProviders.length])

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  return {
    translateProviders,
    formValues,
    selectedProvider,
    isLoading,
    isSaving,
    error,
    handleInlineTranslateProviderChange,
    handleTermFuzzyMatchThresholdChange,
  }
}
