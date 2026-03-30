import { Box, Typography } from '@mui/material'
import type { GlossarySummary } from '../app/types'
import { useListQueryState } from '../app/use-list-query-state'
import { GlossaryListTable } from '../glossary-management/components/glossary-list-table'
import { useGlossaryList } from '../glossary-management/hooks/use-glossary-list'
import { ProjectPageHeader } from '../project-management/components/project-page-header'

export function GlossariesListPage() {
  const {
    searchTerm,
    setSearchTerm,
    sortState,
    setSortState,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
  } = useListQueryState<keyof GlossarySummary>({
    defaultSortColumn: 'lastModifiedAt',
    defaultSortDirection: 'desc',
  })
  const {
    filteredGlossaries,
    isLoading,
    isDeleting,
    error,
    handleDeleteGlossary,
  } = useGlossaryList({ searchTerm })

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title="Glossaries"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Glossaries', to: '/glossaries' },
          { label: 'List' },
        ]}
        actionLabel="Add glossary"
        actionTo="/glossaries/new"
      />

      <GlossaryListTable
        glossaries={filteredGlossaries}
        searchTerm={searchTerm}
        isLoading={isLoading || isDeleting}
        onSearchChange={setSearchTerm}
        onDeleteGlossary={handleDeleteGlossary}
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
