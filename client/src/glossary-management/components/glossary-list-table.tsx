import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { Box, InputAdornment, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import type { GlossarySummary } from '../../app/types'
import { orderBy, orderByDescending, type SortDirection } from '../../app/linq'
import { formatLanguageRoute } from '../../app/utils'
import { SharedTable, type TableDefinition } from '../../components/shared-table'

type GlossaryListTableProps = {
  glossaries: GlossarySummary[]
  searchTerm: string
  isLoading: boolean
  onSearchChange: (value: string) => void
  onDeleteGlossary: (glossaryId: string) => Promise<void>
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

export function GlossaryListTable({
  glossaries,
  searchTerm,
  isLoading,
  onSearchChange,
  onDeleteGlossary,
}: GlossaryListTableProps) {
  const [sortState, setSortState] = useState<{
    column: keyof GlossarySummary
    direction: SortDirection
  } | null>({
    column: 'lastModifiedAt',
    direction: 'desc',
  })

  const sortedGlossaries = useMemo(() => {
    if (!sortState) {
      return glossaries
    }

    const selector = (glossary: GlossarySummary) => glossary[sortState.column]
    return sortState.direction === 'asc'
      ? orderBy(glossaries, selector)
      : orderByDescending(glossaries, selector)
  }, [glossaries, sortState])

  const tableDef: TableDefinition<GlossarySummary> = {
    sortable: true,
    resizable: true,
    stickyHeader: true,
    pagination: true,
    sortState: sortState ?? undefined,
    onSortChange: (column, direction) => {
      setSortState(direction ? { column, direction } : null)
    },
    columns: [
      {
        key: 'name',
        label: 'Glossary',
        gridTemplateColumn: 'minmax(140px, 0.8fr)',
        customRender: (row) => (
          <Box className="shared-primary-cell">
            <Box>
              <Typography component="p" className="shared-row-title">
                {row.name}
              </Typography>
              <Typography component="p" className="shared-row-subtitle">
                {formatLanguageRoute(row.sourceLanguage, row.targetLanguage)}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        key: 'lastModifiedAt',
        label: 'Last modified',
        gridTemplateColumn: 'minmax(120px, 0.6fr)',
        customRender: (row) => {
          const modified = formatDateTime(row.lastModifiedAt)
          return (
            <Box className="shared-created-cell">
              <Typography component="p">{modified.date}</Typography>
              <Typography component="span">{modified.time}</Typography>
            </Box>
          )
        },
      },
      {
        key: 'itemCount',
        label: 'Items',
        gridTemplateColumn: 'minmax(100px, 0.4fr)',
        customRender: (row) => (
          <Box className="shared-segment-cell">
            <Typography component="p">{row.itemCount}</Typography>
            <Typography component="span">registered items</Typography>
          </Box>
        ),
      },
    ],
    action: {
      actions: [
        {
          label: 'Edit',
          icon: <EditOutlinedIcon fontSize="small" />,
          onClick: (row) => {
            window.location.href = `/glossaries/${row.id}`
          },
        },
        {
          label: 'Delete',
          icon: <DeleteOutlineRoundedIcon fontSize="small" />,
          onClick: (row) => {
            void onDeleteGlossary(row.id)
          },
        },
      ],
    },
    rowClick: (row) => {
      window.location.href = `/glossaries/${row.id}`
    },
  }

  return (
    <SharedTable
      data={sortedGlossaries}
      tableDef={tableDef}
      toolbar={
        <TextField
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search..."
          size="small"
          className="shared-toolbar-search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      }
      isLoading={isLoading}
      emptyStateText="No glossary matches this view."
      emptyStateSubtext="Create one to enforce preferred terminology before and after AI translation."
    />
  )
}
