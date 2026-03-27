import { Box, Typography } from '@mui/material'
import { GlossaryListTable } from '../glossary-management/components/glossary-list-table'
import { useGlossaryList } from '../glossary-management/hooks/use-glossary-list'
import { ProjectPageHeader } from '../project-management/components/project-page-header'

export function GlossariesListPage() {
  const {
    filteredGlossaries,
    searchTerm,
    isLoading,
    isDeleting,
    error,
    setSearchTerm,
    handleDeleteGlossary,
  } = useGlossaryList()

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
      />

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
