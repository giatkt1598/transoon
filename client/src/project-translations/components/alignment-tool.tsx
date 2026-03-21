import { Box, Paper, TextField, Typography } from '@mui/material'
import type { ProjectSegment } from '../../app/types'
import { AlignmentToolToolbar } from './alignment-tool-toolbar'

type AlignmentToolProps = {
  segments: ProjectSegment[]
  isLoading: boolean
  isReadOnly: boolean
  isBusy: boolean
  onTargetChange: (segmentId: string, targetText: string) => void
  onOpenAutoTranslate: () => void
}

export function AlignmentTool({
  segments,
  isLoading,
  isReadOnly,
  isBusy,
  onTargetChange,
  onOpenAutoTranslate,
}: AlignmentToolProps) {
  return (
    <Paper className="detail-section-card alignment-tool-shell" elevation={0}>
      <AlignmentToolToolbar isReadOnly={isReadOnly} isBusy={isBusy} onOpenAutoTranslate={onOpenAutoTranslate} />

      <Box className="alignment-grid-shell">
        <Box className="alignment-grid-head">
          <span>No.</span>
          <span>Source</span>
          <span>Target</span>
        </Box>

        {isLoading ? (
          <Box className="empty-state alignment-empty-state">
            <Typography component="p">Loading segments...</Typography>
          </Box>
        ) : segments.length === 0 ? (
          <Box className="empty-state alignment-empty-state">
            <Typography component="p">No segments are ready for alignment yet.</Typography>
          </Box>
        ) : (
          <Box className="alignment-grid-body">
            {segments.map((segment) => (
              <Box key={segment.id} className="alignment-grid-row">
                <Box className="alignment-index-cell">{segment.position}.</Box>

                <Box className="alignment-source-cell">
                  <Typography component="p">{segment.sourceText}</Typography>
                </Box>

                <TextField
                  multiline
                  minRows={2}
                  maxRows={10}
                  fullWidth
                  value={segment.targetText}
                  onChange={(event) => onTargetChange(segment.id, event.target.value)}
                  placeholder="Type target translation..."
                  disabled={isReadOnly}
                  className="alignment-target-field"
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  )
}
