import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { Box, IconButton, InputAdornment, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { TranslationMemorySummary } from '../../app/types'

type TranslationMemoryListTableProps = {
  translationMemories: TranslationMemorySummary[]
  searchTerm: string
  isLoading: boolean
  isDeleting: boolean
  onSearchChange: (value: string) => void
  onDeleteTranslationMemory: (translationMemoryId: string) => Promise<void>
}

function formatDateTime(value: string | null) {
  if (!value) {
    return {
      date: 'Never used',
      time: 'No activity yet',
    }
  }

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

export function TranslationMemoryListTable({
  translationMemories,
  searchTerm,
  isLoading,
  isDeleting,
  onSearchChange,
  onDeleteTranslationMemory,
}: TranslationMemoryListTableProps) {
  return (
    <Paper className="project-table-shell" elevation={0}>
      <Box className="project-table-toolbar">
        <TextField select defaultValue="all" size="small" className="project-toolbar-select">
          <MenuItem value="all">All source</MenuItem>
        </TextField>

        <TextField select defaultValue="all" size="small" className="project-toolbar-select">
          <MenuItem value="all">All target</MenuItem>
        </TextField>

        <TextField
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search translation memories..."
          size="small"
          className="project-toolbar-search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box className="project-table-head translation-memory-table-head">
        <span>Translation memory</span>
        <span>Last modified</span>
        <span>Last used</span>
        <span>Terms</span>
        <span>Actions</span>
      </Box>

      {isLoading ? (
        <Box className="empty-state project-empty-state">
          <Typography component="p">Loading translation memories...</Typography>
        </Box>
      ) : translationMemories.length === 0 ? (
        <Box className="empty-state project-empty-state">
          <Typography component="p">No translation memory matches this view.</Typography>
          <Typography component="p">Create one to organize reusable translated terms and future lookup priority.</Typography>
        </Box>
      ) : (
        <Box className="project-table-body">
          {translationMemories.map((translationMemory) => {
            const modified = formatDateTime(translationMemory.lastModifiedAt)
            const lastUsed = formatDateTime(translationMemory.lastUsedAt)

            return (
              <Box key={translationMemory.id} className="project-table-row translation-memory-table-row">
                <Box className="project-primary-cell">
                  <Box className="project-avatar-badge">
                    {translationMemory.name.slice(0, 1).toUpperCase()}
                  </Box>
                  <Box>
                    <Typography component="p" className="project-row-title">
                      {translationMemory.name}
                    </Typography>
                    <Typography component="p" className="project-row-subtitle">
                      {translationMemory.sourceLanguage} to {translationMemory.targetLanguage}
                    </Typography>
                  </Box>
                </Box>

                <Box className="project-created-cell">
                  <Typography component="p">{modified.date}</Typography>
                  <Typography component="span">{modified.time}</Typography>
                </Box>

                <Box className="project-created-cell">
                  <Typography component="p">{lastUsed.date}</Typography>
                  <Typography component="span">{lastUsed.time}</Typography>
                </Box>

                <Box className="project-segment-cell">
                  <Typography component="p">{translationMemory.termCount}</Typography>
                  <Typography component="span">registered terms</Typography>
                </Box>

                <Box className="project-action-cell">
                  <IconButton
                    component={RouterLink}
                    to={`/translation-memories/${translationMemory.id}/edit`}
                    size="small"
                    aria-label={`Edit ${translationMemory.name}`}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={isDeleting}
                    aria-label={`Delete ${translationMemory.name}`}
                    onClick={() => void onDeleteTranslationMemory(translationMemory.id)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Paper>
  )
}
