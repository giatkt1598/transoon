import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import FindReplaceOutlinedIcon from '@mui/icons-material/FindReplaceOutlined'
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { Box, Button, Paper, Typography } from '@mui/material'

const toolbarActions = [
  { label: 'Confirm', icon: <SaveOutlinedIcon fontSize="small" /> },
  { label: 'Split', icon: <CallSplitOutlinedIcon fontSize="small" /> },
  { label: 'Join', icon: <MergeTypeOutlinedIcon fontSize="small" /> },
  { label: 'Comments', icon: <NotesOutlinedIcon fontSize="small" /> },
  { label: 'Filter', icon: <FilterAltOutlinedIcon fontSize="small" /> },
  { label: 'Find', icon: <FindReplaceOutlinedIcon fontSize="small" /> },
]

export function AlignmentToolToolbar() {
  return (
    <Paper className="alignment-toolbar-shell" elevation={0}>
      <Box>
        <Typography component="p" className="panel-kicker">
          Alignment Tool
        </Typography>
        <Typography component="h3" className="alignment-toolbar-title">
          Translation workspace
        </Typography>
      </Box>

      <Box className="alignment-toolbar-actions">
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
