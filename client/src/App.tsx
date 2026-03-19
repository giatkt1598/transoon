import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type LanguageOption = {
  code: string
  label: string
}

type LanguagesResponse = {
  defaultSourceLanguage: string
  defaultTargetLanguage: string
  languages: LanguageOption[]
}

type TranslateProviderOption = {
  name: string
  description: string
}

type TranslateProvidersResponse = {
  defaultTranslateProvider: string
  translateProviders: TranslateProviderOption[]
}

type TranslationResponse = {
  sourceLanguage: string
  targetLanguage: string
  providerName: string
  documentType: 'docx' | 'txt'
  originalFileName: string
  outputFileName: string
  provider: string
  warnings: string[]
  segmentCount: number
  processingTimeMs: number
  preview: string[]
  downloadUrl: string
}

type PromptPreviewResponse = {
  providerName: string
  sourceLanguage: string
  targetLanguage: string
  supported: boolean
  content: string | null
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
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

const fallbackTranslateProviders: TranslateProvidersResponse = {
  defaultTranslateProvider: 'Google Translate',
  translateProviders: [
    { name: 'Google Translate', description: 'Cloud-style machine translation via google-translate-api-x.' },
    { name: 'DeepSeek r1', description: 'Local Ollama model deepseek-r1:8b for reasoning-heavy translation.' },
    { name: 'Gemma3 1B', description: 'Local Ollama model gemma3:1b for lightweight translation.' },
    { name: 'Qwen2.5 Coder 7B', description: 'Local Ollama model qwen2.5-coder:7b adapted for translation tasks.' },
  ],
}

function App() {
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(fallbackLanguages)
  const [translateProvidersData, setTranslateProvidersData] =
    useState<TranslateProvidersResponse>(fallbackTranslateProviders)
  const [file, setFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState(() =>
    loadStoredValue(storageKeys.sourceLanguage, fallbackLanguages.defaultSourceLanguage),
  )
  const [targetLanguage, setTargetLanguage] = useState(() =>
    loadStoredValue(storageKeys.targetLanguage, fallbackLanguages.defaultTargetLanguage),
  )
  const [providerName, setProviderName] = useState(() =>
    loadStoredValue(storageKeys.providerName, fallbackTranslateProviders.defaultTranslateProvider),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopyingPrompt, setIsCopyingPrompt] = useState(false)
  const [submitStartedAt, setSubmitStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
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
            : data.defaultTranslateProvider,
        )
      } catch {
        setTranslateProvidersData(fallbackTranslateProviders)
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Please choose a .txt or .docx file first.')
      return
    }

    setIsSubmitting(true)
    setSubmitStartedAt(Date.now())
    setElapsedSeconds(0)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
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
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Something went wrong while uploading the document.',
      )
    } finally {
      setIsSubmitting(false)
      setSubmitStartedAt(null)
    }
  }

  async function handleCopyBuildPrompt() {
    setIsCopyingPrompt(true)
    setError(null)

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/translate-providers/${encodeURIComponent(providerName)}/prompt-preview?sourceLanguage=${encodeURIComponent(sourceLanguage)}&targetLanguage=${encodeURIComponent(targetLanguage)}`,
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
    <main className="shell">
      <section className="workspace">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Feature 01</p>
              <h2>Document Intake</h2>
            </div>
          </div>

          <label className="field upload-field">
            <span>Document file</span>
            <input
              type="file"
              accept=".txt,.docx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <small>Supported in this version: `.txt`, `.docx`</small>
          </label>

          <div className="field-grid">
            <label className="field">
              <span>Source language</span>
              <select
                value={sourceLanguage}
                onChange={(event) => setSourceLanguage(event.target.value)}
              >
                {languagesData.languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Target language</span>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
              >
                {languagesData.languages
                  .filter((language) => language.code !== 'auto')
                  .map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Translate provider</span>
            <select
              value={providerName}
              onChange={(event) => setProviderName(event.target.value)}
            >
              {translateProvidersData.translateProviders.map((provider) => (
                <option key={provider.name} value={provider.name}>
                  {provider.name}
                </option>
              ))}
            </select>
            <small>
              {translateProvidersData.translateProviders.find((provider) => provider.name === providerName)?.description ??
                'Select a translation provider.'}
            </small>
          </label>

          <button
            className="secondary-button"
            type="button"
            onClick={handleCopyBuildPrompt}
            disabled={isCopyingPrompt}
          >
            {isCopyingPrompt ? 'Copying buildPrompt...' : 'Copy buildPrompt'}
          </button>

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? `Processing document (${formatTimer(elapsedSeconds)})...` : 'Translate document'}
          </button>

          {error ? <p className="status error">{error}</p> : null}
        </form>

        <div className="panel result-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Result</p>
              <h2>Pipeline Output</h2>
            </div>
          </div>

          {result ? (
            <div className="result-content">
              <div className="result-metrics">
                <div>
                  <span>Document type</span>
                  <strong>{result.documentType.toUpperCase()}</strong>
                </div>
                <div>
                  <span>Text segments</span>
                  <strong>{result.segmentCount}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{result.provider}</strong>
                </div>
                <div>
                  <span>Processing time</span>
                  <strong>{formatProcessingTime(result.processingTimeMs)}</strong>
                </div>
              </div>

              <a className="download-link" href={result.downloadUrl}>
                Download translated file
              </a>

              <div className="preview-block">
                <h3>Preview</h3>
                {result.preview.length > 0 ? (
                  result.preview.map((segment, index) => (
                    <p key={`${segment}-${index}`}>{segment}</p>
                  ))
                ) : (
                  <p>No non-empty text segment was found for preview.</p>
                )}
              </div>

              {result.warnings.length > 0 ? (
                <div className="warning-block">
                  <h3>Warnings</h3>
                  {result.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="empty-state">
              <p>The translated document will appear here after upload.</p>
              <p>
                The server extracts text segments, translates them, then inserts the new
                text back into the original file structure.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function formatProcessingTime(processingTimeMs: number) {
  if (processingTimeMs < 1000) {
    return `${processingTimeMs} ms`
  }

  return `${(processingTimeMs / 1000).toFixed(2)} s`
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function loadStoredValue(storageKey: string, fallbackValue: string) {
  const storedValue = localStorage.getItem(storageKey)
  return storedValue && storedValue.trim().length > 0 ? storedValue : fallbackValue
}

function hasLanguageOption(
  languages: LanguageOption[],
  selectedCode: string,
) {
  return languages.some((language) => language.code === selectedCode)
}

export default App
