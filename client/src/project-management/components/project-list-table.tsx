import {
  SharedTable,
  type TableDefinition,
} from "../../components/shared-table";
import { Box, LinearProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { ProjectSummary } from "../../app/types";
import { formatLanguageRoute } from "../../app/utils";
import { DocumentIcon } from "../../components/document-icon";

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
  isDeleting,
  onSearchChange,
  onDeleteProject,
}: ProjectListTableProps) {
  const navigate = useNavigate();

  const tableDef: TableDefinition<ProjectSummary> = {
    sortable: true,
    resizable: true,
    stickyHeader: true,
    pagination: true,
    columns: [
      {
        key: "name",
        label: "Project",
        gridTemplateColumn: "minmax(140px, 0.8fr)",
        customRender: (item: ProjectSummary) => (
          <Box className="project-primary-cell">
            <DocumentIcon fileName={item.documentFileName} size={36} />
            <Box>
              <Typography component="p" className="project-row-title">
                {String(item.name)}
              </Typography>
              <Typography component="p" className="project-row-subtitle">
                {formatLanguageRoute(item.sourceLang, item.targetLang)}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        key: "lastModifiedAt",
        label: "Last modified",
        gridTemplateColumn: "minmax(120px, 0.6fr)",
        customRender: (row: ProjectSummary) => {
          const lastModifiedAt = formatDateTime(row.lastModifiedAt);
          return (
            <Box className="project-created-cell">
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
        gridTemplateColumn: "minmax(120px, 0.6fr)",
        customRender: (row: ProjectSummary) => {
          const createdAt = formatDateTime(row.createdAt);
          return (
            <Box className="project-created-cell">
              <Typography component="p">{createdAt.date}</Typography>
              <Typography component="span">{createdAt.time}</Typography>
            </Box>
          );
        },
      },
      {
        key: "progressPercent",
        label: "Progress",
        gridTemplateColumn: "minmax(160px, 0.7fr)",
        customRender: ({ progressPercent }: ProjectSummary) => (
          <Box className="project-progress-cell">
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
              {Number(progressPercent)}/{0} translated
            </Typography>
          </Box>
        ),
      },
      {
        key: "segmentCount",
        label: "Segments",
        gridTemplateColumn: "minmax(100px, 0.4fr)",
        customRender: ({ segmentCount: value }: ProjectSummary) => (
          <Box className="project-segment-cell">
            <Typography component="p">
              {Number(value) > 0 ? String(value) : "-"}
            </Typography>
            <Typography component="span">
              {Number(value) > 0 ? `${0} words • ${0} characters` : ""}
            </Typography>
          </Box>
        ),
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
      data={projects}
      tableDef={tableDef}
      searchTerm={searchTerm}
      isLoading={isLoading}
      isDeleting={isDeleting}
      onSearchChange={onSearchChange}
      emptyStateText="No project matches this view."
      emptyStateSubtext="Create a project to manage translations, segments, and review progress."
    />
  );
}
