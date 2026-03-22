import {
  SharedTable,
  type TableDefinition,
} from "../../components/shared-table";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Box,
  InputAdornment,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { ProjectSummary } from "../../app/types";
import { formatLanguageRoute } from "../../app/utils";
import { DocumentIcon } from "../../components/document-icon";
import { orderBy, orderByDescending, type SortDirection } from "../../app/linq";

type ProjectListTableProps = {
  projects: ProjectSummary[];
  searchTerm: string;
  isLoading: boolean;
  isDeleting: boolean;
  onSearchChange: (value: string) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return {
      date: "-",
      time: "-",
    };
  }

  const createdAt = new Date(value);
  return {
    date: createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: createdAt.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function ProjectListTable({
  projects,
  searchTerm,
  isLoading,
  onSearchChange,
  onDeleteProject,
}: ProjectListTableProps) {
  const navigate = useNavigate();
  const [sortState, setSortState] = useState<{
    column: keyof ProjectSummary;
    direction: SortDirection;
  } | null>({
    column: "createdAt",
    direction: "desc",
  });

  const sortedProjects = useMemo(() => {
    if (!sortState) {
      return projects;
    }

    const selector = (project: ProjectSummary) => project[sortState.column];
    return sortState.direction === "asc"
      ? orderBy(projects, selector)
      : orderByDescending(projects, selector);
  }, [projects, sortState]);

  const tableDef: TableDefinition<ProjectSummary> = {
    sortable: true,
    resizable: true,
    stickyHeader: true,
    pagination: true,
    sortState: sortState ?? undefined,
    onSortChange: (column, sortDirection) => {
      setSortState(sortDirection ? { column, direction: sortDirection } : null);
    },
    columns: [
      {
        key: "name",
        label: "Project",
        gridTemplateColumn: "minmax(140px, 1fr)",
        customRender: (item: ProjectSummary) => (
          <Box className="shared-primary-cell">
            <DocumentIcon fileName={item.documentFileName} size={36} />
            <Box>
              <Typography component="p" className="shared-row-title">
                {String(item.name)}
              </Typography>
              <Typography component="p" className="shared-row-subtitle">
                {formatLanguageRoute(item.sourceLang, item.targetLang)}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        key: "progressPercent",
        label: "Progress",
        gridTemplateColumn: "minmax(160px, 0.5fr)",
        customRender: ({
          progressPercent,
          segmentCount,
          translatedSegmentCount,
        }: ProjectSummary) => (
          <Box className="shared-progress-cell">
            <LinearProgress
              variant="determinate"
              value={Number(progressPercent)}
              sx={{
                height: 8,
                borderRadius: "999px",
                backgroundColor: "#e6edf5",
                "& .MuiLinearProgress-bar": {
                  borderRadius: "inherit",
                  background:
                    Number(progressPercent) >= 100 ? "#22c55e" : "#0d67c8",
                },
              }}
            />
            <Typography component="span">
              {translatedSegmentCount}/{segmentCount} translated
            </Typography>
          </Box>
        ),
      },
      {
        key: "segmentCount",
        label: "Segments",
        gridTemplateColumn: "minmax(100px, 0.6fr)",
        customRender: ({
          segmentCount,
          characterCount,
          wordCount,
        }: ProjectSummary) => (
          <Box className="shared-segment-cell">
            <Typography component="p">
              {Number(segmentCount) > 0 ? String(segmentCount) : "-"}
            </Typography>
            <Typography component="span">
              {Number(segmentCount) > 0
                ? `${wordCount} words • ${characterCount} characters`
                : ""}
            </Typography>
          </Box>
        ),
      },
      {
        key: "lastModifiedAt",
        label: "Last modified",
        gridTemplateColumn: "minmax(120px, 0.4fr)",
        customRender: (row: ProjectSummary) => {
          const lastModifiedAt = formatDateTime(row.lastModifiedAt);
          return (
            <Box className="shared-created-cell">
              <Typography component="p">{lastModifiedAt.date}</Typography>
              {row.lastModifiedAt && (
                <Typography component="span">{lastModifiedAt.time}</Typography>
              )}
            </Box>
          );
        },
      },
      {
        key: "createdAt",
        label: "Created at",
        gridTemplateColumn: "minmax(120px, 0.4fr)",
        customRender: (row: ProjectSummary) => {
          const createdAt = formatDateTime(row.createdAt);
          return (
            <Box className="shared-created-cell">
              <Typography component="p">{createdAt.date}</Typography>
              <Typography component="span">{createdAt.time}</Typography>
            </Box>
          );
        },
      },
    ],
    action: {
      useMoreActions: true,
      actions: [
        {
          label: "Edit",
          icon: <EditOutlinedIcon fontSize="small" />,
          onClick: (row) => {
            navigate(`/projects/${row.id}/edit`);
          },
        },
        {
          label: "Delete",
          icon: <DeleteOutlineRoundedIcon fontSize="small" />,
          onClick: (row) => {
            void onDeleteProject(row.id);
          },
        },
      ],
    },
    rowClick: (row) => {
      navigate(`/projects/${row.id}`);
    },
  };

  return (
    <SharedTable
      data={sortedProjects}
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
          sx={{ maxWidth: 400 }}
        />
      }
      isLoading={isLoading}
      emptyStateText="No project matches this view."
      emptyStateSubtext="Create a project to manage translations, segments, and review progress."
    />
  );
}
