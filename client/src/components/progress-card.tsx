import type { TranslationProgressResponse } from '../app/types'

type ProgressCardProps = {
  progress: TranslationProgressResponse
}

export function ProgressCard({ progress }: ProgressCardProps) {
  const progressPercent = Math.max(0, Math.min(100, progress.progressPercent))

  return (
    <div className="progress-card">
      <div className="progress-copy">
        <strong>{progress.phase === 'failed' ? 'Translation failed' : 'Translation progress'}</strong>
        <span>{progressPercent}%</span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <div
          className="progress-bar-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p>{progress.message}</p>
    </div>
  )
}
