import { Box, Paper, TextField, Typography } from '@mui/material'
import { useLayoutEffect, useRef } from 'react'
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from 'react-window'
import type { ProjectSegment } from '../../app/types'
import { AlignmentToolToolbar } from './alignment-tool-toolbar'

type AlignmentToolProps = {
  segments: ProjectSegment[]
  sourceLanguageLabel: string
  targetLanguageLabel: string
  isLoading: boolean
  isReadOnly: boolean
  isBusy: boolean
  isSaving: boolean
  isExporting: boolean
  hasPendingChanges: boolean
  restoreScrollKey?: number
  onTargetChange: (segmentId: string, targetText: string) => void
  onActiveSegmentChange: (segmentExternalId: string | null) => void
  onSaveAll: () => void
  onExport: () => void
  onOpenAutoTranslate: () => void
}

export function AlignmentTool({
  segments,
  sourceLanguageLabel,
  targetLanguageLabel,
  isLoading,
  isReadOnly,
  isBusy,
  isSaving,
  isExporting,
  hasPendingChanges,
  restoreScrollKey = 0,
  onTargetChange,
  onActiveSegmentChange,
  onSaveAll,
  onExport,
  onOpenAutoTranslate,
}: AlignmentToolProps) {
  const listRef = useListRef(null)
  const scrollTopRef = useRef(0)
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 96,
    key: `${segments.length}:${segments.map((segment) => segment.id).join('|')}`,
  })

  const rowData: RowData = {
    segments,
    isReadOnly,
    onTargetChange,
    onActiveSegmentChange,
  }

  useLayoutEffect(() => {
    if (restoreScrollKey === 0 || segments.length === 0) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const element = listRef.current?.element
      if (element) {
        element.scrollTop = scrollTopRef.current
      }
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [listRef, restoreScrollKey, segments.length])

  return (
    <Paper className="detail-section-card alignment-tool-shell" elevation={0}>
      <AlignmentToolToolbar
        isReadOnly={isReadOnly}
        isBusy={isBusy}
        isSaving={isSaving}
        isExporting={isExporting}
        hasPendingChanges={hasPendingChanges}
        onSaveAll={onSaveAll}
        onExport={onExport}
        onOpenAutoTranslate={onOpenAutoTranslate}
      />

      <Box className="alignment-grid-shell">
        <Box className="alignment-grid-head">
          <span>No.</span>
          <span>{`Source (${sourceLanguageLabel})`}</span>
          <span>{`Target (${targetLanguageLabel})`}</span>
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
              listRef={listRef}
              rowComponent={AlignmentVirtualRow}
              rowCount={segments.length}
              rowHeight={rowHeight}
              rowProps={rowData}
              overscanCount={6}
              defaultHeight={480}
              onScroll={(event) => {
                scrollTopRef.current = event.currentTarget.scrollTop
              }}
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
  onActiveSegmentChange: (segmentExternalId: string | null) => void
}

function AlignmentVirtualRow({
  index,
  style,
  segments,
  isReadOnly,
  onTargetChange,
  onActiveSegmentChange,
}: RowComponentProps<RowData>) {
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
          onFocus={() => onActiveSegmentChange(segment.externalSegmentId)}
          placeholder="Type target translation..."
          disabled={isReadOnly}
          className="alignment-target-field"
        />
      </Box>
    </div>
  )
}
