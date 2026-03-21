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
  activeSegmentExternalId: string | null
  inlineTranslatingSegmentId: string | null
  inlineTranslateProviderName: string
  inlineCaretRestoreSegmentId: string | null
  inlineCaretRestoreToken: number
  isPreviewVisible: boolean
  restoreScrollKey?: number
  onTargetChange: (segmentId: string, targetText: string) => void
  onActiveSegmentChange: (segmentExternalId: string | null) => void
  onInlineTranslateSegment: (segmentId: string) => void
  onSaveAll: () => void
  onExport: () => void
  onOpenAutoTranslate: () => void
  onShowPreview: () => void
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
  activeSegmentExternalId,
  inlineTranslatingSegmentId,
  inlineTranslateProviderName,
  inlineCaretRestoreSegmentId,
  inlineCaretRestoreToken,
  isPreviewVisible,
  restoreScrollKey = 0,
  onTargetChange,
  onActiveSegmentChange,
  onInlineTranslateSegment,
  onSaveAll,
  onExport,
  onOpenAutoTranslate,
  onShowPreview,
}: AlignmentToolProps) {
  const listRef = useListRef(null)
  const scrollTopRef = useRef(0)
  const targetInputRefs = useRef(new Map<string, HTMLTextAreaElement | HTMLInputElement>())
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 96,
    key: `${segments.length}:${segments.map((segment) => segment.id).join('|')}`,
  })

  const rowData: RowData = {
    segments,
    isReadOnly,
    activeSegmentExternalId,
    inlineTranslatingSegmentId,
    inlineTranslateProviderName,
    registerTargetInput: (segmentId, element) => {
      if (element) {
        targetInputRefs.current.set(segmentId, element)
        return
      }

      targetInputRefs.current.delete(segmentId)
    },
    onTargetChange,
    onActiveSegmentChange,
    onInlineTranslateSegment,
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

  useLayoutEffect(() => {
    if (!inlineCaretRestoreSegmentId || inlineCaretRestoreToken === 0) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const inputElement = targetInputRefs.current.get(inlineCaretRestoreSegmentId)
      if (!inputElement || document.activeElement !== inputElement) {
        return
      }

      const nextCaretPosition = inputElement.value.length
      inputElement.setSelectionRange(nextCaretPosition, nextCaretPosition)
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [inlineCaretRestoreSegmentId, inlineCaretRestoreToken])

  return (
    <Paper className="detail-section-card alignment-tool-shell" elevation={0}>
      <AlignmentToolToolbar
        isReadOnly={isReadOnly}
        isBusy={isBusy}
        isSaving={isSaving}
        isExporting={isExporting}
        hasPendingChanges={hasPendingChanges}
        isPreviewVisible={isPreviewVisible}
        onSaveAll={onSaveAll}
        onExport={onExport}
        onOpenAutoTranslate={onOpenAutoTranslate}
        onShowPreview={onShowPreview}
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
  activeSegmentExternalId: string | null
  inlineTranslatingSegmentId: string | null
  inlineTranslateProviderName: string
  registerTargetInput: (segmentId: string, element: HTMLTextAreaElement | HTMLInputElement | null) => void
  onTargetChange: (segmentId: string, targetText: string) => void
  onActiveSegmentChange: (segmentExternalId: string | null) => void
  onInlineTranslateSegment: (segmentId: string) => void
}

function AlignmentVirtualRow({
  index,
  style,
  segments,
  isReadOnly,
  activeSegmentExternalId,
  inlineTranslatingSegmentId,
  inlineTranslateProviderName,
  registerTargetInput,
  onTargetChange,
  onActiveSegmentChange,
  onInlineTranslateSegment,
}: RowComponentProps<RowData>) {
  const segment = segments[index]
  const isActive = activeSegmentExternalId === segment.externalSegmentId
  const isInlineTranslating = inlineTranslatingSegmentId === segment.id
  const inlinePlaceholder = isInlineTranslating
    ? `Translating (by ${inlineTranslateProviderName || 'translate provider'})...`
    : 'Type target translation...'
  return (
    <div style={style}>
      <Box className={`alignment-grid-row${isActive ? ' active' : ''}`}>
        <Box className={`alignment-index-cell${isActive ? ' active' : ''}`}>{segment.position}.</Box>

        <Box className="alignment-source-cell">
          <Typography component="p">{segment.sourceText}</Typography>
        </Box>

        <TextField
          multiline
          minRows={2}
          fullWidth
          value={segment.targetText}
          onChange={(event) => onTargetChange(segment.id, event.target.value)}
          inputRef={(element) => registerTargetInput(segment.id, element)}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.code === 'Space') {
              event.preventDefault()
              event.stopPropagation()
              onInlineTranslateSegment(segment.id)
            }
          }}
          onFocus={() => onActiveSegmentChange(segment.externalSegmentId)}
          onBlur={() => onActiveSegmentChange(null)}
          placeholder={inlinePlaceholder}
          disabled={isReadOnly}
          className="alignment-target-field"
        />
      </Box>
    </div>
  )
}
