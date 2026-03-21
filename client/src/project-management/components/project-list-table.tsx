import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import {
  Box,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProjectSummary } from '../../app/types'

type ProjectListTableProps = {
  projects: ProjectSummary[]
  searchTerm: string
  isLoading: boolean
  isDeleting: boolean
  onSearchChange: (value: string) => void
  onDeleteProject: (projectId: string) => Promise<void>
}

function formatCreatedAt(value: string) {
  const createdAt = new Date(value)
  return {
    date: createdAt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    time: createdAt.toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

export function ProjectListTable({
  projects,
  searchTerm,
  isLoading,
  isDeleting,
  onSearchChange,
  onDeleteProject,
}: ProjectListTableProps) {
  const navigate = useNavigate()
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuProject, setMenuProject] = useState<ProjectSummary | null>(null)

  function handleOpenMenu(event: React.MouseEvent<HTMLElement>, project: ProjectSummary) {
    event.stopPropagation()
    setMenuAnchorEl(event.currentTarget)
    setMenuProject(project)
  }

  function handleCloseMenu() {
    setMenuAnchorEl(null)
    setMenuProject(null)
  }

  return (
    <Paper className="project-table-shell" elevation={0}>
      <Box className="project-table-toolbar">
        <TextField select defaultValue="all" size="small" className="project-toolbar-select">
          <MenuItem value="all">All routes</MenuItem>
        </TextField>

        <TextField select defaultValue="all" size="small" className="project-toolbar-select">
          <MenuItem value="all">All status</MenuItem>
        </TextField>

        <TextField
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search projects..."
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

      <Box className="project-table-head">
        <span>Project</span>
        <span>Created at</span>
        <span>Progress</span>
        <span>Segments</span>
        <span>Actions</span>
      </Box>

      {isLoading ? (
        <Box className="empty-state project-empty-state">
          <Typography component="p">Loading projects...</Typography>
        </Box>
      ) : projects.length === 0 ? (
        <Box className="empty-state project-empty-state">
          <Typography component="p">No project matches this view.</Typography>
          <Typography component="p">Create a project to manage translations, segments, and review progress.</Typography>
        </Box>
      ) : (
        <Box className="project-table-body">
          {projects.map((project) => {
            const createdAt = formatCreatedAt(project.createdAt)
            return (
              <Box
                key={project.id}
                className="project-table-row project-table-row-clickable"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <Box className="project-primary-cell">
                  <Box className="project-avatar-badge">{project.name.slice(0, 1).toUpperCase()}</Box>
                  <Box>
                    <Typography component="p" className="project-row-title">
                      {project.name}
                    </Typography>
                    <Typography component="p" className="project-row-subtitle">
                      {project.sourceLang} to {project.targetLang}
                    </Typography>
                  </Box>
                </Box>

                <Box className="project-created-cell">
                  <Typography component="p">{createdAt.date}</Typography>
                  <Typography component="span">{createdAt.time}</Typography>
                </Box>

                <Box className="project-progress-cell">
                  <LinearProgress
                    variant="determinate"
                    value={project.progressPercent}
                    sx={{
                      height: 8,
                      borderRadius: '999px',
                      backgroundColor: '#e6edf5',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 'inherit',
                        background: project.progressPercent >= 100 ? '#22c55e' : '#0d67c8',
                      },
                    }}
                  />
                  <Typography component="span">
                    {project.translatedSegmentCount}/{project.segmentCount || 0} translated
                  </Typography>
                </Box>

                <Box className="project-segment-cell">
                  <Typography component="p">{project.segmentCount}</Typography>
                  <Typography component="span">{project.documentCount} documents</Typography>
                </Box>

                <Box className="project-action-cell">
                  <IconButton
                    size="small"
                    aria-label={`More actions for ${project.name}`}
                    onClick={(event) => handleOpenMenu(event, project)}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuProject)}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem
          onClick={() => {
            if (!menuProject) {
              return
            }

            navigate(`/projects/${menuProject.id}/edit`)
            handleCloseMenu()
          }}
        >
          <EditOutlinedIcon fontSize="small" />
          <Typography component="span" sx={{ ml: 1 }}>
            Edit project
          </Typography>
        </MenuItem>
        <MenuItem
          disabled={isDeleting}
          onClick={() => {
            if (!menuProject) {
              return
            }

            void onDeleteProject(menuProject.id)
            handleCloseMenu()
          }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
          <Typography component="span" sx={{ ml: 1 }}>
            Delete project
          </Typography>
        </MenuItem>
      </Menu>
    </Paper>
  )
}
