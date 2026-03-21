import { Box, LinearProgress, Paper, Typography } from '@mui/material'
import type { ProjectDetail } from '../../app/types'
import { formatLanguageRoute } from '../../app/utils'

type ProjectDetailInformationSectionProps = {
  projectDetail: ProjectDetail
}

export function ProjectDetailInformationSection({ projectDetail }: ProjectDetailInformationSectionProps) {
  return (
    <Paper className="detail-section-card" elevation={0}>
      <Box className="panel-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            Information
          </Typography>
          <Typography component="h2" variant="h4">
            Project overview
          </Typography>
        </Box>
      </Box>

      <Box className="detail-info-grid">
        <Box className="detail-info-item">
          <span>Name</span>
          <strong>{projectDetail.name}</strong>
        </Box>
        <Box className="detail-info-item">
          <span>Language route</span>
          <strong>{formatLanguageRoute(projectDetail.sourceLang, projectDetail.targetLang)}</strong>
        </Box>
        <Box className="detail-info-item">
          <span>Document</span>
          <strong>{projectDetail.documentFileName ?? 'No document uploaded'}</strong>
        </Box>
        <Box className="detail-info-item">
          <span>Created</span>
          <strong>{new Date(projectDetail.createdAt).toLocaleString('en-GB')}</strong>
        </Box>
      </Box>

      <Box className="detail-description-block">
        <span>Description</span>
        <Typography component="p">
          {projectDetail.description || 'No description provided yet.'}
        </Typography>
      </Box>

      <Box className="detail-progress-block">
        <Box className="detail-progress-copy">
          <Box>
            <span>Translation progress</span>
            <strong>{projectDetail.progressPercent}%</strong>
          </Box>
          <Typography component="p">
            {projectDetail.translatedSegmentCount}/{projectDetail.segmentCount} segments translated
            {projectDetail.status === 'auto-translate-processing' ? ' (auto translating...)' : ''}
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={projectDetail.progressPercent}
          sx={{
            height: 10,
            borderRadius: '999px',
            backgroundColor: '#ead9c3',
            '& .MuiLinearProgress-bar': {
              borderRadius: 'inherit',
              background: 'linear-gradient(135deg, #d97f37 0%, #285a53 100%)',
            },
          }}
        />
      </Box>
    </Paper>
  )
}
