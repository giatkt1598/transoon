import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import {
  Box,
  Checkbox,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import type { GlossaryItem } from '../../app/types'
import { orderBy, orderByDescending, type SortDirection } from '../../app/linq'
import {
  SharedTable,
  type TableDefinition,
} from '../../components/shared-table'

type GlossaryItemsTableProps = {
  items: GlossaryItem[]
  isLoading: boolean
  onGlossaryItemDraftChange: (
    glossaryItemId: string,
    field: 'source' | 'target' | 'caseSensitive' | 'priority',
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
  onGlossaryItemDraftChange,
  onGlossaryItemBlur,
  onDeleteGlossaryItem,
}: GlossaryItemsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortState, setSortState] = useState<{
    column: keyof GlossaryItem
    direction: SortDirection
  } | null>({
    column: 'lastModifiedAt',
    direction: 'desc',
  })

  const filteredItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase()
    if (!normalizedSearchTerm) {
      return items
    }

    return items.filter((item) =>
      [item.source, item.target]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearchTerm)),
    )
  }, [items, searchTerm])

  const sortedItems = useMemo(() => {
    if (!sortState) {
      return filteredItems
    }

    const selector = (item: GlossaryItem) => item[sortState.column]
    return sortState.direction === 'asc'
      ? orderBy(filteredItems, selector)
      : orderByDescending(filteredItems, selector)
  }, [filteredItems, sortState])

  const tableDef: TableDefinition<GlossaryItem> = {
    sortable: true,
    stickyHeader: true,
    pagination: true,
    defaultRowsPerPage: 10,
    rowsPerPageOptions: [10, 25, 50],
    sortState: sortState ?? undefined,
    onSortChange: (column, sortDirection) => {
      setSortState(sortDirection ? { column, direction: sortDirection } : null)
    },
    columns: [
      {
        key: 'id',
        label: 'No.',
        gridTemplateColumn: '72px',
        sortable: false,
        customRender: (_row, index) => (
          <Typography component="span">{index + 1}.</Typography>
        ),
      },
      {
        key: 'source',
        label: 'Source',
        gridTemplateColumn: 'minmax(220px, 1.1fr)',
        customRender: (item) => {
          return (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={1}
              value={item.source}
              onChange={(event) =>
                onGlossaryItemDraftChange(item.id, 'source', event.target.value)
              }
              onBlur={() => {
                void onGlossaryItemBlur(item.id)
              }}
            />
          )
        },
      },
      {
        key: 'target',
        label: 'Target',
        gridTemplateColumn: 'minmax(220px, 1.1fr)',
        customRender: (item) => {
          return (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={1}
              value={item.target}
              onChange={(event) =>
                onGlossaryItemDraftChange(item.id, 'target', event.target.value)
              }
              onBlur={() => {
                void onGlossaryItemBlur(item.id)
              }}
            />
          )
        },
      },
      {
        key: 'caseSensitive',
        label: 'Case sensitive',
        gridTemplateColumn: '132px',
        sortValue: (item) => item.caseSensitive,
        customRender: (item) => (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Checkbox
              checked={item.caseSensitive === 1}
              onChange={(event) => {
                onGlossaryItemDraftChange(item.id, 'caseSensitive', event.target.checked)
                void onGlossaryItemBlur(item.id)
              }}
            />
          </Box>
        ),
      },
      {
        key: 'priority',
        label: 'Priority',
        gridTemplateColumn: '120px',
        customRender: (item) => (
          <TextField
            size="small"
            type="number"
            value={item.priority}
            onChange={(event) =>
              onGlossaryItemDraftChange(item.id, 'priority', Number(event.target.value))
            }
            onBlur={() => {
              void onGlossaryItemBlur(item.id)
            }}
            inputProps={{ step: 1 }}
          />
        ),
      },
      {
        key: 'lastModifiedAt',
        label: 'Last modified',
        gridTemplateColumn: 'minmax(140px, 0.65fr)',
        customRender: (item) => {
          const modified = formatDateTime(item.lastModifiedAt)
          return (
            <Box className="shared-created-cell">
              <Typography component="p">{modified.date}</Typography>
              <Typography component="span">{modified.time}</Typography>
            </Box>
          )
        },
      },
    ],
    action: {
      actions: [
        {
          label: 'Delete',
          icon: <DeleteOutlineRoundedIcon fontSize="small" />,
          onClick: (row) => {
            void onDeleteGlossaryItem(row.id)
          },
        },
      ],
    },
  }

  return (
    <SharedTable
      data={sortedItems}
      tableDef={tableDef}
      toolbar={
        <TextField
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search glossary items..."
          size="small"
          className="shared-toolbar-search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 420 }}
        />
      }
      isLoading={isLoading}
      emptyStateText="No glossary item matches this view."
      emptyStateSubtext="Add glossary items to enforce terminology in AI translation."
    />
  )
}
