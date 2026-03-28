import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Box,
  Checkbox,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import type { GlossaryItem } from "../../app/types";
import { orderBy, orderByDescending, type SortDirection } from "../../app/linq";
import {
  SharedTable,
  type TableDefinition,
} from "../../components/shared-table";

type GlossaryItemsTableProps = {
  items: GlossaryItem[];
  isLoading: boolean;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortState: {
    column: keyof GlossaryItem;
    direction: SortDirection;
  } | null;
  onSortChange: (
    sortState: { column: keyof GlossaryItem; direction: SortDirection } | null,
  ) => void;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onGlossaryItemDraftChange: (
    glossaryItemId: string,
    field: "source" | "target" | "caseSensitive",
    value: string | number | boolean,
  ) => void;
  onGlossaryItemBlur: (glossaryItemId: string) => Promise<void>;
  onDeleteGlossaryItem: (glossaryItemId: string) => Promise<void>;
};

function formatDateTime(value: string) {
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

export function GlossaryItemsTable({
  items,
  isLoading,
  sourceLanguageLabel,
  targetLanguageLabel,
  searchTerm,
  onSearchChange,
  sortState,
  onSortChange,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onGlossaryItemDraftChange,
  onGlossaryItemBlur,
  onDeleteGlossaryItem,
}: GlossaryItemsTableProps) {
  const filteredItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
    if (!normalizedSearchTerm) {
      return items;
    }

    return items.filter((item) =>
      [item.source, item.target].some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearchTerm),
      ),
    );
  }, [items, searchTerm]);

  const sortedItems = useMemo(() => {
    if (!sortState) {
      return filteredItems;
    }

    const selector = (item: GlossaryItem) => item[sortState.column];
    return sortState.direction === "asc"
      ? orderBy(filteredItems, selector)
      : orderByDescending(filteredItems, selector);
  }, [filteredItems, sortState]);

  const duplicateItemIds = useMemo(
    () => findDuplicateGlossaryItemIds(items),
    [items],
  );

  const tableDef: TableDefinition<GlossaryItem> = {
    sortable: true,
    stickyHeader: true,
    pagination: true,
    defaultRowsPerPage: 10,
    rowsPerPageOptions: [10, 25, 50],
    sortState: sortState ?? undefined,
    onSortChange: (column, sortDirection) => {
      onSortChange(sortDirection ? { column, direction: sortDirection } : null);
    },
    columns: [
      {
        key: "id",
        label: "No.",
        gridTemplateColumn: "40px",
        sortable: false,
        customRender: (_row, index) => (
          <Typography component="span">{index + 1}.</Typography>
        ),
      },
      {
        key: "sourceNormalized",
        label: "",
        gridTemplateColumn: "48px",
        sortable: false,
        customRender: (item) => {
          const hasDuplicate = duplicateItemIds.has(item.id);
          return hasDuplicate ? (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Tooltip title="Another glossary item already matches this source. Duplicate matching can cause ambiguity.">
                <WarningAmberRoundedIcon fontSize="small" color="warning" />
              </Tooltip>
            </Box>
          ) : null;
        },
      },
      {
        key: "source",
        label: `Source (${sourceLanguageLabel})`,
        gridTemplateColumn: "minmax(220px, 1.1fr)",
        customRender: (item) => (
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={1}
            placeholder="Alias 1; Alias 2; Alias 3"
            value={item.source}
            onChange={(event) =>
              onGlossaryItemDraftChange(item.id, "source", event.target.value)
            }
            onBlur={() => {
              void onGlossaryItemBlur(item.id);
            }}
          />
        ),
      },
      {
        key: "target",
        label: `Target (${targetLanguageLabel})`,
        gridTemplateColumn: "minmax(220px, 1.1fr)",
        customRender: (item) => {
          return (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={1}
              value={item.target}
              onChange={(event) =>
                onGlossaryItemDraftChange(item.id, "target", event.target.value)
              }
              onBlur={() => {
                void onGlossaryItemBlur(item.id);
              }}
            />
          );
        },
      },
      {
        key: "caseSensitive",
        label: "Case sensitive",
        gridTemplateColumn: "132px",
        sortValue: (item) => item.caseSensitive,
        customRender: (item) => (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Checkbox
              checked={item.caseSensitive}
              onChange={(event) => {
                onGlossaryItemDraftChange(
                  item.id,
                  "caseSensitive",
                  event.target.checked,
                );
                void onGlossaryItemBlur(item.id);
              }}
            />
          </Box>
        ),
      },
      {
        key: "lastModifiedAt",
        label: "Last modified",
        gridTemplateColumn: "minmax(140px, 0.65fr)",
        customRender: (item) => {
          const modified = formatDateTime(item.lastModifiedAt);
          return (
            <Box className="shared-created-cell">
              <Typography component="p">{modified.date}</Typography>
              <Typography component="span">{modified.time}</Typography>
            </Box>
          );
        },
      },
    ],
    action: {
      actions: [
        {
          label: "Delete",
          icon: <DeleteOutlineRoundedIcon fontSize="small" />,
          onClick: (row) => {
            void onDeleteGlossaryItem(row.id);
          },
        },
      ],
    },
  };

  return (
    <SharedTable
      data={sortedItems}
      tableDef={tableDef}
      toolbar={
        <TextField
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
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
      controlledPagination={{
        page,
        rowsPerPage,
        onPageChange,
        onRowsPerPageChange,
      }}
      isLoading={isLoading}
      emptyStateText="No glossary item matches this view."
    />
  );
}

function findDuplicateGlossaryItemIds(items: GlossaryItem[]) {
  const duplicateIds = new Set<string>();

  for (let index = 0; index < items.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < items.length; nextIndex += 1) {
      if (isDuplicateGlossarySource(items[index], items[nextIndex])) {
        duplicateIds.add(items[index].id);
        duplicateIds.add(items[nextIndex].id);
      }
    }
  }

  return duplicateIds;
}

function isDuplicateGlossarySource(left: GlossaryItem, right: GlossaryItem) {
  const leftSources = splitGlossarySourceValues(left.source);
  const rightSources = splitGlossarySourceValues(right.source);
  if (leftSources.length === 0 || rightSources.length === 0) {
    return false;
  }

  return leftSources.some((leftSource) =>
    rightSources.some((rightSource) => {
      if (leftSource === rightSource) {
        return true;
      }

      return (
        leftSource.toLocaleLowerCase() === rightSource.toLocaleLowerCase() &&
        (!left.caseSensitive || !right.caseSensitive)
      );
    }),
  );
}

function splitGlossarySourceValues(value: string) {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
