import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { AppSettings, TranslateProviderOption } from '../../app/types'
import { fetchSettings, fetchTranslateProviders, saveSettings } from '../api'

type SettingsFormValues = AppSettings

export function useSettingsPage() {
  const [translateProviders, setTranslateProviders] = useState<TranslateProviderOption[]>([])
  const [defaultTranslateProvider, setDefaultTranslateProvider] = useState('Google Translate')
  const [formValues, setFormValues] = useState<SettingsFormValues>({
    inlineTranslateProvider: 'Google Translate',
    termFuzzyMatchThreshold: 0.9,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSettingsPage() {
      try {
        setIsLoading(true)
        const [providersResponse, settings] = await Promise.all([
          fetchTranslateProviders(controller.signal),
          fetchSettings(controller.signal),
        ])

        const resolvedInlineTranslateProvider = providersResponse.translateProviders.some(
          (provider) => provider.name === settings.inlineTranslateProvider,
        )
          ? settings.inlineTranslateProvider
          : providersResponse.defaultTranslateProvider

        setTranslateProviders(providersResponse.translateProviders)
        setDefaultTranslateProvider(providersResponse.defaultTranslateProvider)
        setFormValues({
          inlineTranslateProvider: resolvedInlineTranslateProvider,
          termFuzzyMatchThreshold: settings.termFuzzyMatchThreshold,
        })
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
      translateProviders.find((provider) => provider.name === defaultTranslateProvider) ??
      null,
    [defaultTranslateProvider, formValues.inlineTranslateProvider, translateProviders],
  )

  function handleInlineTranslateProviderChange(value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      inlineTranslateProvider: value,
    }))
  }

  function handleTermFuzzyMatchThresholdChange(value: number) {
    setFormValues((currentValues) => ({
      ...currentValues,
      termFuzzyMatchThreshold: value,
    }))
  }

  async function handleSaveSettings() {
    setIsSaving(true)
    setError(null)

    try {
      const savedSettings = await saveSettings(formValues)
      setFormValues(savedSettings)
      toast.success('Settings saved successfully.')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not save settings.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return {
    translateProviders,
    formValues,
    selectedProvider,
    isLoading,
    isSaving,
    error,
    handleInlineTranslateProviderChange,
    handleTermFuzzyMatchThresholdChange,
    handleSaveSettings,
  }
}
