import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded'
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import FindReplaceOutlinedIcon from '@mui/icons-material/FindReplaceOutlined'
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { Box, Button, Paper } from '@mui/material'

const toolbarActions = [
  { label: 'Auto Translate', icon: <AutoFixHighRoundedIcon fontSize="small" />, action: 'auto-translate' },
  { label: 'Split', icon: <CallSplitOutlinedIcon fontSize="small" /> },
  { label: 'Join', icon: <MergeTypeOutlinedIcon fontSize="small" /> },
  { label: 'Comments', icon: <NotesOutlinedIcon fontSize="small" /> },
  { label: 'Filter', icon: <FilterAltOutlinedIcon fontSize="small" /> },
  { label: 'Find', icon: <FindReplaceOutlinedIcon fontSize="small" /> },
]

type AlignmentToolToolbarProps = {
  isReadOnly: boolean
  isBusy: boolean
  isSaving: boolean
  isExporting: boolean
  hasPendingChanges: boolean
  onSaveAll: () => void
  onExport: () => void
  onOpenAutoTranslate: () => void
}

export function AlignmentToolToolbar({
  isReadOnly,
  isBusy,
  isSaving,
  isExporting,
  hasPendingChanges,
  onSaveAll,
  onExport,
  onOpenAutoTranslate,
}: AlignmentToolToolbarProps) {
  return (
    <Paper className="alignment-toolbar-shell" elevation={0}>
      <Box className="alignment-toolbar-actions">
        <Button
          variant="outlined"
          size="small"
          startIcon={<SaveOutlinedIcon fontSize="small" />}
          disabled={isReadOnly || isSaving || !hasPendingChanges}
          onClick={onSaveAll}
          className="alignment-toolbar-button"
        >
          {isSaving ? 'Saving...' : 'Save all'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadRoundedIcon fontSize="small" />}
          disabled={isReadOnly || isExporting || isBusy}
          onClick={onExport}
          className="alignment-toolbar-button"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
        {toolbarActions.map((action) => (
          <Button
            key={action.label}
            variant="outlined"
            size="small"
            startIcon={action.icon}
            disabled={action.action === 'auto-translate' ? isReadOnly || isBusy : true}
            onClick={action.action === 'auto-translate' ? onOpenAutoTranslate : undefined}
            className="alignment-toolbar-button"
          >
            {action.label}
          </Button>
        ))}
      </Box>
    </Paper>
  )
}
