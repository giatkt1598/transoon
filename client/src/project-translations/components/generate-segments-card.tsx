import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { Box, Button, Paper, Typography } from '@mui/material'

type GenerateSegmentsCardProps = {
  canGenerate: boolean
  isGenerating: boolean
  onGenerate: () => void
}

export function GenerateSegmentsCard({ canGenerate, isGenerating, onGenerate }: GenerateSegmentsCardProps) {
  return (
    <Paper className="detail-section-card generate-segments-shell" elevation={0}>
      <Box className="generate-segments-copy">
        <Typography component="p" className="panel-kicker">
          Translations
        </Typography>
        <Typography component="h2" variant="h4">
          Generate project segments
        </Typography>
        <Typography component="p">
          Build the alignment workspace from the uploaded document first. After generation, the source segments will
          appear in the editor and the target column will be ready for translation.
        </Typography>
      </Box>

      <Button
        variant="contained"
        className="submit-button generate-segments-button"
        startIcon={<AutoAwesomeOutlinedIcon />}
        disabled={!canGenerate || isGenerating}
        onClick={onGenerate}
      >
        {isGenerating ? 'Generating segments...' : 'Generate Segments'}
      </Button>

      {!canGenerate ? (
        <Typography component="span" className="generate-segments-note">
          Upload a project document first before generating segments.
        </Typography>
      ) : null}
    </Paper>
  )
}
