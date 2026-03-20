import { Box, LinearProgress, Typography } from '@mui/material'
import type { TranslationProgressResponse } from '../app/types'

type ProgressCardProps = {
  progress: TranslationProgressResponse
}

export function ProgressCard({ progress }: ProgressCardProps) {
  const progressPercent = Math.max(0, Math.min(100, progress.progressPercent))

  return (
    <Box className="progress-card">
      <Box className="progress-copy">
        <Typography component="strong">
          {progress.phase === 'failed' ? 'Translation failed' : 'Translation progress'}
        </Typography>
        <Typography component="span">{progressPercent}%</Typography>
      </Box>
      <LinearProgress
        aria-hidden="true"
        className="progress-bar"
        variant="determinate"
        value={progressPercent}
        sx={{
          height: 12,
          borderRadius: '999px',
          backgroundColor: '#ead9c3',
          '& .MuiLinearProgress-bar': {
            borderRadius: 'inherit',
            background: 'linear-gradient(135deg, #d97f37 0%, #285a53 100%)',
          },
        }}
      />
      <Typography component="p">{progress.message}</Typography>
    </Box>
  )
}
