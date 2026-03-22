import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  TablePagination,
  TableSortLabel,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import "./shared-table.scss";
import type { SortDirection } from "../app/linq";

export type ColumnDefinition<T> = {
  key: keyof T;
  label: string;
  customRender?: (row: T, index: number) => React.ReactNode;
  sortValue?: (row: T) => string | number | boolean | Date | null | undefined;
  className?: string;
  gridTemplateColumn?: string;
  sortable?: boolean;
};

export type TableDefinition<T> = {
  sortable?: boolean;
  resizable?: boolean;
  stickyHeader?: boolean;
  pagination?: boolean;
  sortState?: {
    column: keyof T;
    direction: SortDirection;
  };
  defaultRowsPerPage?: number;
  rowsPerPageOptions?: number[];
  columns: ColumnDefinition<T>[];
  action: {
    useMoreActions?: boolean;
    gridTemplateColumn?: string;
    actions?: Array<{
      label: string;
      icon: React.ReactNode;
      onClick: (row: T) => void;
    }>;
  };
  rowClick?: (row: T, index: number) => void;
  onSortChange?: (column: keyof T, sortDirection: SortDirection | null) => void;
};

type SharedTableProps<T> = {
  data: T[];
  tableDef: TableDefinition<T>;
  toolbar?: React.ReactNode;
  isLoading: boolean;
  emptyStateText?: string;
  emptyStateSubtext?: string;
};

export function SharedTable<T extends { id: string }>({
  data,
  tableDef,
  toolbar,
  isLoading,
  emptyStateText = "No items match this view.",
  emptyStateSubtext = "Create an item to get started.",
}: SharedTableProps<T>) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuItem, setMenuItem] = useState<T | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(
    tableDef.defaultRowsPerPage ?? 10,
  );
  const hasActions = Boolean(tableDef.action.actions?.length);
  const rowsPerPageOptions = tableDef.rowsPerPageOptions ?? [10, 25, 50];

  const gridTemplateColumns = useMemo(() => {
    return [
      ...tableDef.columns.map((column) => column.gridTemplateColumn || "1fr"),
      ...(hasActions ? [tableDef.action.gridTemplateColumn ?? "80px"] : []),
    ].join(" ");
  }, [hasActions, tableDef.action.gridTemplateColumn, tableDef.columns]);

  const pageCount = tableDef.pagination
    ? Math.max(1, Math.ceil(data.length / rowsPerPage))
    : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows = tableDef.pagination
    ? data.slice(
        currentPage * rowsPerPage,
        currentPage * rowsPerPage + rowsPerPage,
      )
    : data;

  function handleOpenMenu(event: React.MouseEvent<HTMLElement>, item: T) {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuItem(item);
  }

  function handleCloseMenu() {
    setMenuAnchorEl(null);
    setMenuItem(null);
  }

  function renderCellValue(
    column: ColumnDefinition<T>,
    item: T,
    index: number,
  ) {
    const value = item[column.key];

    if (column.customRender) {
      return column.customRender(item, index);
    }

    return String(value);
  }

  function handleSort(column: ColumnDefinition<T>) {
    if (!tableDef.sortable || column.sortable === false) {
      return;
    }

    const isSameColumn = tableDef.sortState?.column === column.key;
    const nextSortDirection = !isSameColumn
      ? "asc"
      : tableDef.sortState?.direction === "asc"
        ? "desc"
        : tableDef.sortState?.direction === "desc"
          ? null
          : "asc";

    tableDef.onSortChange?.(column.key, nextSortDirection);
  }

  return (
    <Paper className="shared-table-shell" elevation={0}>
      {toolbar ? <Box className="shared-table-toolbar">{toolbar}</Box> : null}
      <Box
        className="shared-table-head"
        style={{
          gridTemplateColumns,
          position: tableDef.stickyHeader ? "sticky" : "static",
          top: tableDef.stickyHeader ? 0 : "auto",
          backgroundColor: tableDef.stickyHeader ? undefined : "transparent",
          zIndex: tableDef.stickyHeader ? 10 : "auto",
          display: "grid",
        }}
      >
        {tableDef.columns.map((column) => (
          <Box
            key={String(column.key)}
            className={
              tableDef.sortable && column.sortable !== false
                ? "shared-table-head-cell shared-table-head-cell-sortable"
                : "shared-table-head-cell"
            }
            onClick={() => {
              if (tableDef.sortable && column.sortable !== false) {
                handleSort(column);
              }
            }}
          >
            {tableDef.sortable && column.sortable !== false ? (
              <TableSortLabel
                active={tableDef.sortState?.column === column.key}
                direction={
                  tableDef.sortState?.column === column.key &&
                  tableDef.sortState.direction
                    ? tableDef.sortState.direction
                    : "asc"
                }
                hideSortIcon={false}
              >
                {column.label}
              </TableSortLabel>
            ) : (
              column.label
            )}
          </Box>
        ))}
        {hasActions && <Box className="shared-table-head-cell">Actions</Box>}
      </Box>

      {isLoading ? (
        <Box className="empty-state">
          <Typography component="p">Loading...</Typography>
        </Box>
      ) : data.length === 0 ? (
        <Box className="empty-state">
          <Typography component="p">{emptyStateText}</Typography>
          <Typography component="p">{emptyStateSubtext}</Typography>
        </Box>
      ) : (
        <Box className="shared-table-body">
          {pagedRows.map((item, index) => (
            <Box
              key={item.id}
              className={`shared-table-row ${tableDef.rowClick ? "shared-table-row-clickable" : ""}`}
              onClick={() => {
                if (tableDef.rowClick) {
                  tableDef.rowClick(item, index);
                }
              }}
              style={{
                display: "grid",
                gridTemplateColumns,
              }}
            >
              {tableDef.columns.map((column) => (
                <Box
                  key={String(column.key)}
                  className={`shared-table-body-cell ${column.className ?? ""}`.trim()}
                >
                  {renderCellValue(column, item, index)}
                </Box>
              ))}

              {!tableDef.action.useMoreActions ? (
                <>
                  {hasActions && (
                    <Box className="shared-table-body-cell shared-action-cell">
                      {tableDef.action.actions?.map((action, actionIndex) => (
                        <IconButton
                          key={actionIndex}
                          size="small"
                          aria-label={action.label}
                          onClick={(event) => {
                            event.stopPropagation();
                            action.onClick(item);
                          }}
                        >
                          {action.icon}
                        </IconButton>
                      ))}
                    </Box>
                  )}
                </>
              ) : (
                <Box className="shared-table-body-cell shared-action-cell">
                  <IconButton
                    size="small"
                    aria-label={`More actions for ${item.id}`}
                    onClick={(event) => handleOpenMenu(event, item)}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {tableDef.pagination && data.length > 0 ? (
        <TablePagination
          component="div"
          className="shared-table-pagination"
          count={data.length}
          page={currentPage}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={rowsPerPageOptions}
        />
      ) : null}

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuItem)}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {tableDef.action.actions?.map((action) => (
          <MenuItem
            key={action.label}
            onClick={() => {
              if (!menuItem) return;
              action.onClick?.(menuItem);
              handleCloseMenu();
            }}
          >
            {action.icon}
            <Typography component="span" sx={{ ml: 1 }}>
              {action.label}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}
