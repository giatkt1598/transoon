import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import { useMemo } from "react";
import { orderBy, orderByDescending, type SortDirection } from "../../app/linq";
import type { TranslationMemoryTerm } from "../../app/types";
import { SharedTable, type TableDefinition } from "../../components/shared-table";
import { TranslationMemoryTermsTransferControls } from "./translation-memory-terms-transfer-controls";
import type { TranslationMemoryTermDraft } from "../translation-memory-term-transfer";

type TranslationMemoryTermsTableProps = {
  translationMemoryName: string;
  terms: TranslationMemoryTerm[];
  isLoading: boolean;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  searchInputValue: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortState: {
    column: keyof TranslationMemoryTerm;
    direction: SortDirection;
  } | null;
  onSortChange: (
    sortState: { column: keyof TranslationMemoryTerm; direction: SortDirection } | null,
  ) => void;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onTermDraftChange: (
    termId: string,
    field: "sourceTerm" | "targetTerm",
    value: string,
  ) => void;
  onTermBlur: (termId: string) => Promise<void>;
  onDeleteTerm: (termId: string) => Promise<void>;
  onImportTerms: (items: TranslationMemoryTermDraft[]) => void | Promise<void>;
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

export function TranslationMemoryTermsTable({
  translationMemoryName,
  terms,
  isLoading,
  sourceLanguageCode,
  targetLanguageCode,
  sourceLanguageLabel,
  targetLanguageLabel,
  searchInputValue,
  searchTerm,
  onSearchChange,
  sortState,
  onSortChange,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onTermDraftChange,
  onTermBlur,
  onDeleteTerm,
  onImportTerms,
}: TranslationMemoryTermsTableProps) {
  const filteredTerms = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
    if (!normalizedSearchTerm) {
      return terms;
    }

    return terms.filter((term) =>
      [term.sourceTerm, term.targetTerm].some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearchTerm),
      ),
    );
  }, [searchTerm, terms]);

  const sortedTerms = useMemo(() => {
    if (!sortState) {
      return filteredTerms;
    }

    const selector = (term: TranslationMemoryTerm) => term[sortState.column];
    return sortState.direction === "asc"
      ? orderBy(filteredTerms, selector)
      : orderByDescending(filteredTerms, selector);
  }, [filteredTerms, sortState]);

  const tableDef: TableDefinition<TranslationMemoryTerm> = {
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
        customRender: (_term, index) => <Typography component="span">{index + 1}.</Typography>,
      },
      {
        key: "sourceTerm",
        label: `Source (${sourceLanguageLabel})`,
        gridTemplateColumn: "minmax(220px, 1.1fr)",
        customRender: (term) => (
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={1}
            value={term.sourceTerm}
            onChange={(event) =>
              onTermDraftChange(term.id, "sourceTerm", event.target.value)
            }
            onBlur={() => {
              void onTermBlur(term.id);
            }}
          />
        ),
      },
      {
        key: "targetTerm",
        label: `Target (${targetLanguageLabel})`,
        gridTemplateColumn: "minmax(220px, 1.1fr)",
        customRender: (term) => (
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={1}
            value={term.targetTerm}
            onChange={(event) =>
              onTermDraftChange(term.id, "targetTerm", event.target.value)
            }
            onBlur={() => {
              void onTermBlur(term.id);
            }}
          />
        ),
      },
      {
        key: "lastModifiedAt",
        label: "Last modified",
        gridTemplateColumn: "minmax(140px, 0.65fr)",
        customRender: (term) => {
          const modified = formatDateTime(term.lastModifiedAt);
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
            void onDeleteTerm(row.id);
          },
        },
      ],
    },
  };

  return (
    <SharedTable
      data={sortedTerms}
      tableDef={tableDef}
      toolbar={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <TextField
            value={searchInputValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search translation memory terms..."
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
          <TranslationMemoryTermsTransferControls
            translationMemoryName={translationMemoryName}
            terms={terms}
            sourceLanguageCode={sourceLanguageCode}
            targetLanguageCode={targetLanguageCode}
            sourceLanguageLabel={sourceLanguageLabel}
            targetLanguageLabel={targetLanguageLabel}
            onImportItems={onImportTerms}
          />
        </Box>
      }
      controlledPagination={{
        page,
        rowsPerPage,
        onPageChange,
        onRowsPerPageChange,
      }}
      isLoading={isLoading}
      emptyStateText="No translation memory term matches this view."
    />
  );
}
