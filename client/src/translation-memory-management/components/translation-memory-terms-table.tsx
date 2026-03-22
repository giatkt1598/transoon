import { Box, TextField, Typography } from '@mui/material'
import type { TranslationMemoryTerm } from '../../app/types'
import './translation-memory-terms-table.scss'

type TranslationMemoryTermsTableProps = {
  terms: TranslationMemoryTerm[]
  isLoading: boolean
  savingTermIds: string[]
  onTermDraftChange: (
    termId: string,
    field: 'sourceTerm' | 'targetTerm',
    value: string,
  ) => void
  onTermBlur: (termId: string) => Promise<void>
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

export function TranslationMemoryTermsTable({
  terms,
  isLoading,
  savingTermIds,
  onTermDraftChange,
  onTermBlur,
}: TranslationMemoryTermsTableProps) {
  if (isLoading) {
    return (
      <Box className="empty-state">
        <Typography component="p">Loading terms...</Typography>
      </Box>
    )
  }

  if (terms.length === 0) {
    return (
      <Box className="empty-state">
        <Typography component="p">No terms in this translation memory.</Typography>
        <Typography component="p">Terms confirmed into this memory will appear here.</Typography>
      </Box>
    )
  }

  return (
    <Box className="tm-terms-grid-shell">
      <Box className="tm-terms-grid-head">
        <span>No.</span>
        <span>Source</span>
        <span>Target</span>
        <span>Last modified</span>
      </Box>

      <Box className="tm-terms-grid-body">
        {terms.map((term, index) => {
          const modified = formatDateTime(term.lastModifiedAt)
          const isSavingTerm = savingTermIds.includes(term.id)

          return (
            <Box key={term.id} className="tm-terms-grid-row">
              <Box className="tm-terms-index-cell">
                <Typography component="span">{index + 1}.</Typography>
              </Box>

              <Box className="tm-terms-editor-cell">
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={1}
                  value={term.sourceTerm}
                  disabled={isSavingTerm}
                  onChange={(event) =>
                    onTermDraftChange(term.id, 'sourceTerm', event.target.value)
                  }
                  onBlur={() => {
                    void onTermBlur(term.id)
                  }}
                />
              </Box>

              <Box className="tm-terms-editor-cell">
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={1}
                  value={term.targetTerm}
                  disabled={isSavingTerm}
                  onChange={(event) =>
                    onTermDraftChange(term.id, 'targetTerm', event.target.value)
                  }
                  onBlur={() => {
                    void onTermBlur(term.id)
                  }}
                />
              </Box>

              <Box className="tm-terms-meta-cell">
                <Typography component="p">{modified.date}</Typography>
                <Typography component="span">{modified.time}</Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
