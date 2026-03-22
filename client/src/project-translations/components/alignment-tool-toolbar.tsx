import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded'
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import FindReplaceOutlinedIcon from '@mui/icons-material/FindReplaceOutlined'
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { Box, Button, Paper, Tooltip } from '@mui/material'

const toolbarActions = [
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
  isPreviewVisible: boolean
  canConfirmCurrent: boolean
  onSaveAll: () => void
  onConfirmCurrent: () => void
  onExport: () => void
  onOpenAutoTranslate: () => void
  onShowPreview: () => void
}

export function AlignmentToolToolbar({
  isReadOnly,
  isBusy,
  isSaving,
  isExporting,
  hasPendingChanges,
  isPreviewVisible,
  canConfirmCurrent,
  onSaveAll,
  onConfirmCurrent,
  onExport,
  onOpenAutoTranslate,
  onShowPreview,
}: AlignmentToolToolbarProps) {
  return (
    <Paper className="alignment-toolbar-shell" elevation={0}>
      <Box className="alignment-toolbar-actions">
        <Tooltip title="Ctrl + S" arrow placement="bottom">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveOutlinedIcon fontSize="small" />}
              disabled={isReadOnly || isSaving}
              onClick={onSaveAll}
              className="alignment-toolbar-button"
            >
              {isSaving ? 'Saving...' : hasPendingChanges ? 'Save*' : 'Save'}
            </Button>
          </span>
        </Tooltip>
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
        {!isPreviewVisible ? (
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionOutlinedIcon fontSize="small" />}
            onClick={onShowPreview}
            className="alignment-toolbar-button"
          >
            Preview
          </Button>
        ) : null}
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoFixHighRoundedIcon fontSize="small" />}
          disabled={isReadOnly || isBusy}
          onClick={onOpenAutoTranslate}
          className="alignment-toolbar-button"
        >
          Auto Translate
        </Button>
        <Tooltip title="Ctrl + Enter" arrow placement="bottom">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CheckCircleRoundedIcon fontSize="small" />}
              disabled={!canConfirmCurrent}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onConfirmCurrent}
              className="alignment-toolbar-button"
            >
              Confirm
            </Button>
          </span>
        </Tooltip>
        {toolbarActions.map((action) => (
          <Button
            key={action.label}
            variant="outlined"
            size="small"
            startIcon={action.icon}
            disabled
            className="alignment-toolbar-button"
          >
            {action.label}
          </Button>
        ))}
      </Box>
    </Paper>
  )
}
