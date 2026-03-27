import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { Box, Checkbox, IconButton, TextField, Typography } from '@mui/material'
import type { GlossaryItem } from '../../app/types'
import './glossary-items-table.scss'

type GlossaryItemsTableProps = {
  items: GlossaryItem[]
  isLoading: boolean
  savingItemIds: string[]
  deletingItemIds: string[]
  onGlossaryItemDraftChange: (
    glossaryItemId: string,
    field: 'source' | 'target' | 'caseSensitive' | 'wholeWord' | 'priority',
    value: string | number | boolean,
  ) => void
  onGlossaryItemBlur: (glossaryItemId: string) => Promise<void>
  onDeleteGlossaryItem: (glossaryItemId: string) => Promise<void>
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return {
    date: date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

export function GlossaryItemsTable({
  items,
  isLoading,
  savingItemIds,
  deletingItemIds,
  onGlossaryItemDraftChange,
  onGlossaryItemBlur,
  onDeleteGlossaryItem,
}: GlossaryItemsTableProps) {
  if (isLoading) {
    return (
      <Box className="empty-state">
        <Typography component="p">Loading glossary items...</Typography>
      </Box>
    )
  }

  if (items.length === 0) {
    return (
      <Box className="empty-state">
        <Typography component="p">No items in this glossary.</Typography>
        <Typography component="p">Add glossary items to enforce terminology in AI translation.</Typography>
      </Box>
    )
  }

  return (
    <Box className="glossary-items-grid-shell">
      <Box className="glossary-items-grid-head">
        <span>No.</span>
        <span>Source</span>
        <span>Target</span>
        <span>Case sensitive</span>
        <span>Whole word</span>
        <span>Priority</span>
        <span>Last modified</span>
        <span />
      </Box>

      <Box className="glossary-items-grid-body">
        {items.map((item, index) => {
          const modified = formatDateTime(item.lastModifiedAt)
          const isSavingItem = savingItemIds.includes(item.id)
          const isDeletingItem = deletingItemIds.includes(item.id)
          const isBusy = isSavingItem || isDeletingItem

          return (
            <Box key={item.id} className="glossary-items-grid-row">
              <Box className="glossary-items-index-cell">
                <Typography component="span">{index + 1}.</Typography>
              </Box>

              <Box className="glossary-items-editor-cell">
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={1}
                  value={item.source}
                  disabled={isBusy}
                  onChange={(event) => onGlossaryItemDraftChange(item.id, 'source', event.target.value)}
                  onBlur={() => {
                    void onGlossaryItemBlur(item.id)
                  }}
                />
              </Box>

              <Box className="glossary-items-editor-cell">
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={1}
                  value={item.target}
                  disabled={isBusy}
                  onChange={(event) => onGlossaryItemDraftChange(item.id, 'target', event.target.value)}
                  onBlur={() => {
                    void onGlossaryItemBlur(item.id)
                  }}
                />
              </Box>

              <Box className="glossary-items-flag-cell">
                <Checkbox
                  checked={item.caseSensitive === 1}
                  disabled={isBusy}
                  onChange={(event) => {
                    onGlossaryItemDraftChange(item.id, 'caseSensitive', event.target.checked)
                    void onGlossaryItemBlur(item.id)
                  }}
                />
              </Box>

              <Box className="glossary-items-flag-cell">
                <Checkbox
                  checked={item.wholeWord === 1}
                  disabled={isBusy}
                  onChange={(event) => {
                    onGlossaryItemDraftChange(item.id, 'wholeWord', event.target.checked)
                    void onGlossaryItemBlur(item.id)
                  }}
                />
              </Box>

              <Box className="glossary-items-priority-cell">
                <TextField
                  size="small"
                  type="number"
                  value={item.priority}
                  disabled={isBusy}
                  onChange={(event) => onGlossaryItemDraftChange(item.id, 'priority', Number(event.target.value))}
                  onBlur={() => {
                    void onGlossaryItemBlur(item.id)
                  }}
                  inputProps={{ step: 1 }}
                />
              </Box>

              <Box className="glossary-items-meta-cell">
                <Typography component="p">{modified.date}</Typography>
                <Typography component="span">{modified.time}</Typography>
              </Box>

              <Box className="glossary-items-action-cell">
                <IconButton
                  size="small"
                  disabled={isBusy}
                  onClick={() => {
                    void onDeleteGlossaryItem(item.id)
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
