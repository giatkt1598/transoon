import { Box, Paper, TextField, Typography } from '@mui/material'
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window'
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
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 96,
    key: `${segments.length}:${segments.map((segment) => segment.id).join('|')}`,
  })

  const rowData: RowData = {
    segments,
    isReadOnly,
    onTargetChange,
  }

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
            <List
              className="alignment-virtual-list"
              rowComponent={AlignmentVirtualRow}
              rowCount={segments.length}
              rowHeight={rowHeight}
              rowProps={rowData}
              overscanCount={6}
              defaultHeight={480}
              style={{ height: '100%' }}
            />
          </Box>
        )}
      </Box>
    </Paper>
  )
}

type RowData = {
  segments: ProjectSegment[]
  isReadOnly: boolean
  onTargetChange: (segmentId: string, targetText: string) => void
}

function AlignmentVirtualRow({ index, style, segments, isReadOnly, onTargetChange }: RowComponentProps<RowData>) {
  const segment = segments[index]
  return (
    <div style={style}>
      <Box className="alignment-grid-row">
        <Box className="alignment-index-cell">{segment.position}.</Box>

        <Box className="alignment-source-cell">
          <Typography component="p">{segment.sourceText}</Typography>
        </Box>

        <TextField
          multiline
          minRows={2}
          fullWidth
          value={segment.targetText}
          onChange={(event) => onTargetChange(segment.id, event.target.value)}
          placeholder="Type target translation..."
          disabled={isReadOnly}
          className="alignment-target-field"
        />
      </Box>
    </div>
  )
}
