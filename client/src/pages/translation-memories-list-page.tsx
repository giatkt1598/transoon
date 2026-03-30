import { Box, Typography } from '@mui/material'
import type { TranslationMemorySummary } from '../app/types'
import { useListQueryState } from '../app/use-list-query-state'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { TranslationMemoryListTable } from '../translation-memory-management/components/translation-memory-list-table'
import { useTranslationMemoryList } from '../translation-memory-management/hooks/use-translation-memory-list'

export function TranslationMemoriesListPage() {
  const {
    searchTerm,
    setSearchTerm,
    sortState,
    setSortState,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
  } = useListQueryState<keyof TranslationMemorySummary>({
    defaultSortColumn: 'lastModifiedAt',
    defaultSortDirection: 'desc',
  })
  const {
    filteredTranslationMemories,
    isLoading,
    isDeleting,
    error,
    handleDeleteTranslationMemory,
  } = useTranslationMemoryList({ searchTerm })

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title="Translation Memories"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Translation Memories', to: '/translation-memories' },
          { label: 'List' },
        ]}
        actionLabel="Add memory"
        actionTo="/translation-memories/new"
      />

      <TranslationMemoryListTable
        translationMemories={filteredTranslationMemories}
        searchTerm={searchTerm}
        isLoading={isLoading || isDeleting}
        onSearchChange={setSearchTerm}
        onDeleteTranslationMemory={handleDeleteTranslationMemory}
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
