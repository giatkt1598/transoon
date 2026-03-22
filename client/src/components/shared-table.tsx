import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
  Box,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";

export type ColumnDefinition<T> = {
  key: keyof T;
  label: string;
  customRender?: (row: T, index: number) => React.ReactNode;
  className?: string;
  gridTemplateColumn?: string;
};

export type TableDefinition<T> = {
  sortable?: boolean;
  resizable?: boolean;
  stickyHeader?: boolean;
  pagination?: boolean;
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
};

type SharedTableProps<T> = {
  data: T[];
  tableDef: TableDefinition<T>;
  searchTerm: string;
  isLoading: boolean;
  isDeleting: boolean;
  onSearchChange: (value: string) => void;
  onDeleteItem?: (itemId: string) => Promise<void>;
  onEditItem?: (itemId: string) => void;
  onItemClick?: (item: T) => void;
  emptyStateText?: string;
  emptyStateSubtext?: string;
};

export function SharedTable<T extends { id: string }>({
  data,
  tableDef,
  searchTerm,
  isLoading,
  isDeleting,
  onSearchChange,
  onItemClick,
  emptyStateText = "No items match this view.",
  emptyStateSubtext = "Create an item to get started.",
}: SharedTableProps<T>) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuItem, setMenuItem] = useState<T | null>(null);

  const gridTemplateColumns = useMemo(() => {
    const gridTemplate =
      tableDef.columns
        .map((column) => column.gridTemplateColumn || "1fr")
        .join(" ") +
      (tableDef.action.actions?.length
        ? (tableDef.action.gridTemplateColumn ?? "60px")
        : "");

    return gridTemplate;
  }, [
    tableDef.action.actions?.length,
    tableDef.action.gridTemplateColumn,
    tableDef.columns,
  ]);

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

  return (
    <Paper className="project-table-shell" elevation={0}>
      <Box className="project-table-toolbar">
        <TextField
          select
          defaultValue="all"
          size="small"
          className="project-toolbar-select"
        >
          <MenuItem value="all">All source</MenuItem>
        </TextField>

        <TextField
          select
          defaultValue="all"
          size="small"
          className="project-toolbar-select"
        >
          <MenuItem value="all">All target</MenuItem>
        </TextField>

        <TextField
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search..."
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

      <Box
        className="project-table-head"
        sx={{
          display: "grid",
          gridTemplateColumns: gridTemplateColumns,
          position: tableDef.stickyHeader ? "sticky" : "static",
          top: tableDef.stickyHeader ? 0 : "auto",
          backgroundColor: tableDef.stickyHeader ? "white" : "transparent",
          zIndex: tableDef.stickyHeader ? 10 : "auto",
        }}
      >
        {tableDef.columns.map((column) => (
          <span key={String(column.key)}>{column.label}</span>
        ))}
        {!!tableDef.action.actions?.length && <span>Actions</span>}
      </Box>

      {isLoading ? (
        <Box className="empty-state project-empty-state">
          <Typography component="p">Loading...</Typography>
        </Box>
      ) : data.length === 0 ? (
        <Box className="empty-state project-empty-state">
          <Typography component="p">{emptyStateText}</Typography>
          <Typography component="p">{emptyStateSubtext}</Typography>
        </Box>
      ) : (
        <Box className="project-table-body">
          {data.map((item, index) => (
            <Box
              key={item.id}
              className={`project-table-row ${onItemClick ? "project-table-row-clickable" : ""}`}
              onClick={() => {
                if (tableDef.rowClick) {
                  tableDef.rowClick(item, index);
                }
                onItemClick?.(item);
              }}
              sx={{
                display: "grid",
                gridTemplateColumns: gridTemplateColumns,
              }}
            >
              {tableDef.columns.map((column) => (
                <Box key={String(column.key)} className={column.className}>
                  {renderCellValue(column, item, index)}
                </Box>
              ))}

              {!tableDef.action.useMoreActions ? (
                <>
                  {!!tableDef.action.actions?.length && (
                    <Box className="project-action-cell">
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
                <Box className="project-action-cell">
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
            disabled={isDeleting}
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
