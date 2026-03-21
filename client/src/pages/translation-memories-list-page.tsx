import { Box, Typography } from '@mui/material'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { TranslationMemoryListTable } from '../translation-memory-management/components/translation-memory-list-table'
import { useTranslationMemoryList } from '../translation-memory-management/hooks/use-translation-memory-list'

export function TranslationMemoriesListPage() {
  const {
    filteredTranslationMemories,
    searchTerm,
    isLoading,
    isDeleting,
    error,
    setSearchTerm,
    handleDeleteTranslationMemory,
  } = useTranslationMemoryList()

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
        isLoading={isLoading}
        isDeleting={isDeleting}
        onSearchChange={setSearchTerm}
        onDeleteTranslationMemory={handleDeleteTranslationMemory}
      />

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
