import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type PropsWithChildren,
} from 'react'
import { apiBaseUrl } from './config'
import { getAppSocket } from './socket'
import type {
  LanguagesResponse,
  PromptPreviewResponse,
  TranslateProvidersResponse,
  TranslationProgressResponse,
  TranslationResponse,
} from './types'
import { hasLanguageOption, loadStoredValue } from './utils'

type TranslationAppContextValue = {
  languagesData: LanguagesResponse
  translateProvidersData: TranslateProvidersResponse
  file: File | null
  sourceLanguage: string
  targetLanguage: string
  providerName: string
  isSubmitting: boolean
  isCopyingPrompt: boolean
  elapsedSeconds: number
  progress: TranslationProgressResponse | null
  error: string | null
  result: TranslationResponse | null
  setFile: (file: File | null) => void
  setSourceLanguage: (value: string) => void
  setTargetLanguage: (value: string) => void
  setProviderName: (value: string) => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleCopyBuildPrompt: () => Promise<void>
}

const storageKeys = {
  sourceLanguage: 'transoon.sourceLanguage',
  targetLanguage: 'transoon.targetLanguage',
  providerName: 'transoon.providerName',
} as const

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

const emptyTranslateProviders: TranslateProvidersResponse = {
  defaultTranslateProvider: '',
  translateProviders: [],
}

const TranslationAppContext = createContext<TranslationAppContextValue | null>(null)

export function TranslationAppProvider({ children }: PropsWithChildren) {
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(fallbackLanguages)
  const [translateProvidersData, setTranslateProvidersData] =
    useState<TranslateProvidersResponse>(emptyTranslateProviders)
  const [file, setFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState(() =>
    loadStoredValue(storageKeys.sourceLanguage, fallbackLanguages.defaultSourceLanguage),
  )
  const [targetLanguage, setTargetLanguage] = useState(() =>
    loadStoredValue(storageKeys.targetLanguage, fallbackLanguages.defaultTargetLanguage),
  )
  const [providerName, setProviderName] = useState(() =>
    loadStoredValue(storageKeys.providerName, ''),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopyingPrompt, setIsCopyingPrompt] = useState(false)
  const [submitStartedAt, setSubmitStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [progress, setProgress] = useState<TranslationProgressResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranslationResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadLanguages() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/languages`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Could not load language options.')
        }

        const data: LanguagesResponse = await response.json()
        setLanguagesData(data)
        setSourceLanguage((currentValue) =>
          hasLanguageOption(data.languages, currentValue) ? currentValue : data.defaultSourceLanguage,
        )
        setTargetLanguage((currentValue) =>
          hasLanguageOption(
            data.languages.filter((language) => language.code !== 'auto'),
            currentValue,
          )
            ? currentValue
            : data.defaultTargetLanguage,
        )
      } catch {
        setLanguagesData(fallbackLanguages)
      }
    }

    void loadLanguages()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadTranslateProviders() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/translate-providers`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Could not load translate providers.')
        }

        const data: TranslateProvidersResponse = await response.json()
        setTranslateProvidersData(data)
        setProviderName((currentValue) =>
          data.translateProviders.some((provider) => provider.name === currentValue)
            ? currentValue
            : data.defaultTranslateProvider || data.translateProviders[0]?.name || '',
        )
      } catch (loadError) {
        setTranslateProvidersData(emptyTranslateProviders)
        setProviderName('')
        setError(
          loadError instanceof Error ? loadError.message : 'Could not load translate providers.',
        )
      }
    }

    void loadTranslateProviders()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    localStorage.setItem(storageKeys.sourceLanguage, sourceLanguage)
  }, [sourceLanguage])

  useEffect(() => {
    localStorage.setItem(storageKeys.targetLanguage, targetLanguage)
  }, [targetLanguage])

  useEffect(() => {
    localStorage.setItem(storageKeys.providerName, providerName)
  }, [providerName])

  useEffect(() => {
    if (!isSubmitting || submitStartedAt === null) {
      setElapsedSeconds(0)
      return
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - submitStartedAt) / 1000))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isSubmitting, submitStartedAt])

  useEffect(() => {
    if (!isSubmitting || !activeRequestId) {
      return
    }

    const socket = getAppSocket()
    const requestId = activeRequestId
    const handleProgress = (nextProgress: TranslationProgressResponse) => {
      if (nextProgress.requestId === requestId) {
        setProgress(nextProgress)
      }
    }

    socket.on('translation-progress', handleProgress)
    socket.emit('translation-progress:subscribe', requestId)

    return () => {
      socket.emit('translation-progress:unsubscribe', requestId)
      socket.off('translation-progress', handleProgress)
    }
  }, [activeRequestId, isSubmitting])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Please choose a supported document file first (.txt, .docx, .xlsx, .csv, .pptx).')
      return
    }
    if (!providerName) {
      setError('Translate provider list is unavailable. Please try reloading the page.')
      return
    }

    setIsSubmitting(true)
    setSubmitStartedAt(Date.now())
    setElapsedSeconds(0)
    const requestId = crypto.randomUUID()
    setActiveRequestId(requestId)
    setProgress({
      requestId,
      phase: 'queued',
      totalChunks: 0,
      completedChunks: 0,
      progressPercent: 0,
      message: 'Preparing translation request.',
      updatedAt: new Date().toISOString(),
    })
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('requestId', requestId)
      formData.append('file', file)
      formData.append('sourceLanguage', sourceLanguage)
      formData.append('targetLanguage', targetLanguage)
      formData.append('providerName', providerName)

      const response = await fetch(`${apiBaseUrl}/api/translate-document`, {
        method: 'POST',
        body: formData,
      })

      const data = (await response.json()) as TranslationResponse | { error: string }
      if (!response.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : 'Translation failed.')
      }

      setResult(data)
      setProgress((currentProgress) => ({
        requestId: data.requestId,
        phase: 'completed',
        totalChunks: currentProgress?.totalChunks ?? 0,
        completedChunks: currentProgress?.totalChunks ?? 0,
        progressPercent: 100,
        message: 'Translation completed.',
        updatedAt: new Date().toISOString(),
      }))
    } catch (submitError) {
      setProgress((currentProgress) =>
        currentProgress
          ? {
              ...currentProgress,
              phase: 'failed',
              progressPercent: 100,
              message:
                submitError instanceof Error
                  ? submitError.message
                  : 'Something went wrong while uploading the document.',
              updatedAt: new Date().toISOString(),
            }
          : currentProgress,
      )
      setError(
        submitError instanceof Error ? submitError.message : 'Something went wrong while uploading the document.',
      )
    } finally {
      setIsSubmitting(false)
      setSubmitStartedAt(null)
      setActiveRequestId(null)
    }
  }

  async function handleCopyBuildPrompt() {
    if (!file) {
      setError('Please choose a supported document file first (.txt, .docx, .xlsx, .csv, .pptx).')
      return
    }
    if (!providerName) {
      setError('Translate provider list is unavailable. Please try reloading the page.')
      return
    }

    setIsCopyingPrompt(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sourceLanguage', sourceLanguage)
      formData.append('targetLanguage', targetLanguage)

      const response = await fetch(
        `${apiBaseUrl}/api/translate-providers/${encodeURIComponent(providerName)}/prompt-preview`,
        {
          method: 'POST',
          body: formData,
        },
      )
      const data = (await response.json()) as PromptPreviewResponse | { error: string }

      if (!response.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : 'Could not load buildPrompt.')
      }

      if (!data.supported || !data.content) {
        throw new Error(`Provider "${providerName}" does not expose buildPrompt.`)
      }

      await navigator.clipboard.writeText(data.content)
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Could not copy buildPrompt.')
    } finally {
      setIsCopyingPrompt(false)
    }
  }

  return (
    <TranslationAppContext.Provider
      value={{
        languagesData,
        translateProvidersData,
        file,
        sourceLanguage,
        targetLanguage,
        providerName,
        isSubmitting,
        isCopyingPrompt,
        elapsedSeconds,
        progress,
        error,
        result,
        setFile,
        setSourceLanguage,
        setTargetLanguage,
        setProviderName,
        handleSubmit,
        handleCopyBuildPrompt,
      }}
    >
      {children}
    </TranslationAppContext.Provider>
  )
}

export function useTranslationApp() {
  const context = useContext(TranslationAppContext)

  if (!context) {
    throw new Error('useTranslationApp must be used within TranslationAppProvider.')
  }

  return context
}
