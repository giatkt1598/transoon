import { Box, Typography } from '@mui/material'
import { ProjectListTable } from '../project-management/components/project-list-table'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { useProjectList } from '../project-management/hooks/use-project-list'

export function ProjectsListPage() {
  const { filteredProjects, searchTerm, isLoading, isDeleting, error, setSearchTerm, handleDeleteProject } =
    useProjectList()

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title="Projects"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Projects', to: '/projects' },
          { label: 'List' },
        ]}
        actionLabel="Add project"
        actionTo="/projects/new"
      />

      <ProjectListTable
        projects={filteredProjects}
        searchTerm={searchTerm}
        isLoading={isLoading}
        isDeleting={isDeleting}
        onSearchChange={setSearchTerm}
        onDeleteProject={handleDeleteProject}
      />

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
