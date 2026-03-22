import {
  SharedTable,
  type TableDefinition,
} from "../../components/shared-table";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { TranslationMemorySummary } from "../../app/types";
import { formatLanguageRoute } from "../../app/utils";
import {
  orderBy,
  orderByDescending,
  type SortDirection,
} from "../../app/linq";

type TranslationMemoryListTableProps = {
  translationMemories: TranslationMemorySummary[];
  searchTerm: string;
  isLoading: boolean;
  isDeleting: boolean;
  onSearchChange: (value: string) => void;
  onDeleteTranslationMemory: (translationMemoryId: string) => Promise<void>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return {
      date: "Never used",
      time: "No activity yet",
    };
  }

  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function TranslationMemoryListTable({
  translationMemories,
  searchTerm,
  isLoading,
  isDeleting,
  onSearchChange,
  onDeleteTranslationMemory,
}: TranslationMemoryListTableProps) {
  const [sortState, setSortState] = useState<{
    column: keyof TranslationMemorySummary;
    direction: SortDirection;
  } | null>({
    column: "lastModifiedAt",
    direction: "desc",
  });

  const sortedTranslationMemories = useMemo(() => {
    if (!sortState) {
      return translationMemories;
    }

    const selector = (translationMemory: TranslationMemorySummary) =>
      translationMemory[sortState.column];
    return sortState.direction === "asc"
      ? orderBy(translationMemories, selector)
      : orderByDescending(translationMemories, selector);
  }, [sortState, translationMemories]);

  const tableDef: TableDefinition<TranslationMemorySummary> = {
    sortable: true,
    resizable: true,
    stickyHeader: true,
    pagination: true,
    sortState: sortState ?? undefined,
    onSortChange: (column, sortDirection) => {
      setSortState(
        sortDirection
          ? { column, direction: sortDirection }
          : null,
      );
    },
    columns: [
      {
        key: "name",
        label: "Translation memory",
        gridTemplateColumn: "minmax(140px, 0.8fr)",
        customRender: (row: TranslationMemorySummary) => (
          <Box className="shared-primary-cell">
            <Box>
              <Typography component="p" className="shared-row-title">
                {String(row.name)}
              </Typography>
              <Typography component="p" className="shared-row-subtitle">
                {formatLanguageRoute(row.sourceLanguage, row.targetLanguage)}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        key: "lastModifiedAt",
        label: "Last modified",
        gridTemplateColumn: "minmax(120px, 0.6fr)",
        customRender: (row: TranslationMemorySummary) => {
          const modified = formatDateTime(row.lastModifiedAt);
          return (
            <Box className="shared-created-cell">
              <Typography component="p">{modified.date}</Typography>
              <Typography component="span">{modified.time}</Typography>
            </Box>
          );
        },
      },
      {
        key: "lastUsedAt",
        label: "Last used",
        gridTemplateColumn: "minmax(120px, 0.6fr)",
        customRender: (row: TranslationMemorySummary) => {
          const lastUsed = formatDateTime(row.lastUsedAt);
          return (
            <Box className="shared-created-cell">
              <Typography component="p">{lastUsed.date}</Typography>
              <Typography component="span">{lastUsed.time}</Typography>
            </Box>
          );
        },
      },
      {
        key: "termCount",
        label: "Terms",
        gridTemplateColumn: "minmax(100px, 0.4fr)",
        customRender: (row: TranslationMemorySummary) => (
          <Box className="shared-segment-cell">
            <Typography component="p">{String(row.termCount)}</Typography>
            <Typography component="span">registered terms</Typography>
          </Box>
        ),
      },
    ],
    action: {
      actions: [
        {
          label: "Edit",
          icon: <EditOutlinedIcon fontSize="small" />,
          onClick: (row) => {
            window.location.href = `/translation-memories/${row.id}/edit`;
          },
        },
        {
          label: "Delete",
          icon: <DeleteOutlineRoundedIcon fontSize="small" />,
          onClick: (row) => {
            void onDeleteTranslationMemory(row.id);
          },
        },
      ],
    },
    rowClick: (row) => {
      window.location.href = `/translation-memories/${row.id}/edit`;
    },
  };

  return (
    <SharedTable
      data={sortedTranslationMemories}
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
      isDeleting={isDeleting}
      emptyStateText="No translation memory matches this view."
      emptyStateSubtext="Create one to organize reusable translated terms and future lookup priority."
    />
  );
}
