import { useTranslationApp } from '../app/translation-app-context'
import { formatTimer } from '../app/utils'
import { ProgressCard } from './progress-card'

export function DocumentIntakePanel() {
  const {
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
    setFile,
    setSourceLanguage,
    setTargetLanguage,
    setProviderName,
    handleSubmit,
    handleCopyBuildPrompt,
  } = useTranslationApp()

  return (
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
          accept=".txt,.docx,.xlsx"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <small>
          {file
            ? `Selected file: ${file.name}`
            : 'Supported in this version: `.txt`, `.docx`, `.xlsx`'}
        </small>
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
          disabled={translateProvidersData.translateProviders.length === 0}
        >
          {translateProvidersData.translateProviders.map((provider) => (
            <option key={provider.name} value={provider.name}>
              {provider.name}
            </option>
          ))}
        </select>
        <small>
          {translateProvidersData.translateProviders.find((provider) => provider.name === providerName)?.description ??
            (translateProvidersData.translateProviders.length === 0
              ? 'Translate providers are loaded only from the server API.'
              : 'Select a translation provider.')}
        </small>
      </label>

      <button
        className="secondary-button"
        type="button"
        onClick={handleCopyBuildPrompt}
        disabled={isCopyingPrompt || !providerName}
      >
        {isCopyingPrompt ? 'Copying buildPrompt...' : 'Copy buildPrompt'}
      </button>

      <button className="submit-button" type="submit" disabled={isSubmitting || !providerName}>
        {isSubmitting ? `Processing document (${formatTimer(elapsedSeconds)})...` : 'Translate document'}
      </button>

      {isSubmitting && progress ? <ProgressCard progress={progress} /> : null}
      {error ? <p className="status error">{error}</p> : null}
    </form>
  )
}
