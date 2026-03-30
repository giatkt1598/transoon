import { Box, Typography } from '@mui/material'
import type { ProjectSummary } from '../app/types'
import { useListQueryState } from '../app/use-list-query-state'
import { ProjectListTable } from '../project-management/components/project-list-table'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { useProjectList } from '../project-management/hooks/use-project-list'

export function ProjectsListPage() {
  const {
    searchTerm,
    setSearchTerm,
    sortState,
    setSortState,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
  } = useListQueryState<keyof ProjectSummary>({
    defaultSortColumn: 'createdAt',
    defaultSortDirection: 'desc',
  })
  const { filteredProjects, isLoading, isDeleting, error, handleDeleteProject } =
    useProjectList({ searchTerm })

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
        isLoading={isLoading || isDeleting}
        onSearchChange={setSearchTerm}
        onDeleteProject={handleDeleteProject}
        sortState={sortState}
        onSortChange={setSortState}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={setRowsPerPage}
      />

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
