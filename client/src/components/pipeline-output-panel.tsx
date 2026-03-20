import { Box, Button, Link, Paper, Typography } from '@mui/material'
import { useTranslationApp } from '../app/translation-app-context'
import { formatProcessingTime } from '../app/utils'

export function PipelineOutputPanel() {
  const { result } = useTranslationApp()

  return (
    <Paper className="panel result-panel" elevation={0}>
      <Box className="panel-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            Result
          </Typography>
          <Typography component="h2" variant="h4">
            Pipeline Output
          </Typography>
        </Box>
      </Box>

      {result ? (
        <Box className="result-content">
          <Box className="result-metrics">
            {[
              ['Document type', result.documentType.toUpperCase()],
              ['Text segments', String(result.segmentCount)],
              ['Provider', result.provider],
              ['Processing time', formatProcessingTime(result.processingTimeMs)],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography component="span">{label}</Typography>
                <Typography component="strong">{value}</Typography>
              </Box>
            ))}
          </Box>

          <Button
            className="download-link"
            component={Link}
            href={result.downloadUrl}
            underline="none"
          >
            Download translated file
          </Button>

          <Box className="preview-block">
            <Typography component="h3">Preview</Typography>
            {result.preview.length > 0 ? (
              result.preview.map((segment, index) => (
                <Typography key={`${segment}-${index}`} component="p">
                  {segment}
                </Typography>
              ))
            ) : (
              <Typography component="p">No non-empty text segment was found for preview.</Typography>
            )}
          </Box>

          {result.warnings.length > 0 ? (
            <Box className="warning-block">
              <Typography component="h3">Warnings</Typography>
              {result.warnings.map((warning) => (
                <Typography key={warning} component="p">
                  {warning}
                </Typography>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : (
        <Box className="empty-state">
          <Typography component="p">The translated document will appear here after upload.</Typography>
          <Typography component="p">
            The server extracts text segments, translates them, then inserts the new
            text back into the original file structure.
          </Typography>
        </Box>
      )}
    </Paper>
  )
}
