import { Box, Typography } from '@mui/material'

export function TranslatorHero() {
  return (
    <Box component="section" className="hero-panel">
      <Box className="hero-copy">
        <Typography className="eyebrow">Translation workspace</Typography>
        <Typography component="h1">Move documents through one clean pipeline.</Typography>
        <Typography className="lead">
          Searchable provider selection, realtime progress, and export-safe handlers for
          DOCX, XLSX, PPTX, and TXT.
        </Typography>
        <Box className="hero-notes">
          <span>Provider-aware routing</span>
          <span>Realtime progress</span>
          <span>Format-preserving output</span>
        </Box>
      </Box>

      <Box className="hero-stat-card">
        <Typography className="hero-stat-label">Today&apos;s throughput</Typography>
        <Typography className="hero-stat-value">24 docs</Typography>
        <Box className="hero-stat-row">
          <Box>
            <Typography className="hero-stat-kicker">Active provider</Typography>
            <Typography className="hero-stat-copy">Google Translate</Typography>
          </Box>
          <Box>
            <Typography className="hero-stat-kicker">Pipeline status</Typography>
            <Typography className="hero-stat-copy">Healthy</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
