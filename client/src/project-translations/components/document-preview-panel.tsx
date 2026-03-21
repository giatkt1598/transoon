import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { Box, IconButton, Paper, Typography } from '@mui/material'
import type { ProjectDocumentPreview, ProjectSegment } from '../../app/types'
import { DocxDocumentPreview } from './docx-document-preview'
import { XlsxDocumentPreview } from './xlsx-document-preview'

type DocumentPreviewPanelProps = {
  preview: ProjectDocumentPreview | null
  segments: ProjectSegment[]
  activeSegmentExternalId: string | null
  isLoading: boolean
  error: string | null
  onClose: () => void
}

export function DocumentPreviewPanel({
  preview,
  segments,
  activeSegmentExternalId,
  isLoading,
  error,
  onClose,
}: DocumentPreviewPanelProps) {
  return (
    <Paper className="detail-section-card document-preview-shell" elevation={0}>
      <Box className="panel-heading document-preview-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            Document Preview
          </Typography>
          <Typography component="h2" variant="h4">
            Preview panel
          </Typography>
        </Box>
        <IconButton
          size="small"
          className="document-preview-close-button"
          onClick={onClose}
          aria-label="Close preview"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      {isLoading ? (
        <Placeholder message="Loading preview..." />
      ) : error ? (
        <Placeholder message={error} />
      ) : !preview ? (
        <Placeholder message="No preview is available yet." />
      ) : 'supported' in preview ? (
        <Placeholder message={preview.message} />
      ) : preview.documentType === 'docx' ? (
        <DocxDocumentPreview
          preview={preview}
          segments={segments}
          activeSegmentExternalId={activeSegmentExternalId}
        />
      ) : preview.documentType === 'xlsx' ? (
        <XlsxDocumentPreview
          preview={preview}
          segments={segments}
          activeSegmentExternalId={activeSegmentExternalId}
        />
      ) : (
        <Placeholder message="Preview is not available for this document type yet." />
      )}
    </Paper>
  )
}

function Placeholder({ message }: { message: string }) {
  return (
    <Box className="document-preview-placeholder">
      <DescriptionOutlinedIcon />
      <Typography component="p">{message}</Typography>
    </Box>
  )
}
