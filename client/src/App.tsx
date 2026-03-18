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
  defaultTranslateProvider: string
  translateProviders: string[]
  languages: LanguageOption[]
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
  preview: string[]
  downloadUrl: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

const fallbackLanguages: LanguagesResponse = {
  defaultSourceLanguage: 'en',
  defaultTargetLanguage: 'ja',
  defaultTranslateProvider: 'Google Translate',
  translateProviders: ['Google Translate', 'DeepSeek r1'],
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

function App() {
  const [languagesData, setLanguagesData] = useState<LanguagesResponse>(fallbackLanguages)
  const [file, setFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState(fallbackLanguages.defaultSourceLanguage)
  const [targetLanguage, setTargetLanguage] = useState(fallbackLanguages.defaultTargetLanguage)
  const [providerName, setProviderName] = useState(fallbackLanguages.defaultTranslateProvider)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
        setSourceLanguage(data.defaultSourceLanguage)
        setTargetLanguage(data.defaultTargetLanguage)
        setProviderName(data.defaultTranslateProvider)
      } catch {
        setLanguagesData(fallbackLanguages)
      }
    }

    void loadLanguages()

    return () => controller.abort()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Please choose a .txt or .docx file first.')
      return
    }

    setIsSubmitting(true)
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
    }
  }

  return (
    <main className="shell">
      <section className="hero-panel">
        <p className="eyebrow">Transoon</p>
        <h1>Upload a document and send it straight into the translation pipeline.</h1>
        <p className="lead">
          This first feature supports <strong>TXT</strong> and <strong>DOCX</strong>,
          lets the user pick source and target languages, then rebuilds a translated file
          with the new text inserted back into the document.
        </p>
        <div className="hero-notes">
          <span>Default route: English to Japanese</span>
          <span>Formatting-safe replacement for DOCX text nodes</span>
        </div>
      </section>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Feature 01</p>
              <h2>Document Intake</h2>
            </div>
            <span className="badge">Upload {'->'} Extract {'->'} Replace</span>
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
              {languagesData.translateProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>

          <div className="selection-summary">
            <div>
              <span>Selected file</span>
              <strong>{file?.name ?? 'No file selected yet'}</strong>
            </div>
            <div>
              <span>Language route</span>
              <strong>
                {sourceLanguage} {'->'} {targetLanguage}
              </strong>
            </div>
            <div>
              <span>Translate provider</span>
              <strong>{providerName}</strong>
            </div>
          </div>

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Processing document...' : 'Translate document'}
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

export default App
