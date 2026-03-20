import { useTranslationApp } from '../app/translation-app-context'
import { formatProcessingTime } from '../app/utils'

export function PipelineOutputPanel() {
  const { result } = useTranslationApp()

  return (
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
  )
}
