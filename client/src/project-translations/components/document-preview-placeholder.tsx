import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { Box, Paper, Typography } from '@mui/material'

export function DocumentPreviewPlaceholder() {
  return (
    <Paper className="detail-section-card document-preview-shell" elevation={0}>
      <Box className="panel-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            DocumentPreview
          </Typography>
          <Typography component="h2" variant="h4">
            Preview panel
          </Typography>
        </Box>
      </Box>

      <Box className="document-preview-placeholder">
        <DescriptionOutlinedIcon />
        <Typography component="p">Document preview will be implemented in the next step.</Typography>
        <Typography component="span">
          The layout is ready so we can plug in a live document renderer later without disturbing the alignment tool.
        </Typography>
      </Box>
    </Paper>
  )
}
