import { Box, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { GlossaryEditorForm } from '../glossary-management/components/glossary-editor-form'
import { useGlossaryEditor } from '../glossary-management/hooks/use-glossary-editor'
import { ProjectPageHeader } from '../project-management/components/project-page-header'

export function GlossaryEditorPage() {
  const { glossaryId } = useParams()
  const {
    languagesData,
    glossary,
    formValues,
    isEditMode,
    isLoading,
    isSaving,
    error,
    handleFieldChange,
    handleSaveGlossary,
  } = useGlossaryEditor({ glossaryId })

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={isEditMode ? 'Edit glossary' : 'Create a new glossary'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Glossaries', to: '/glossaries' },
          { label: isEditMode ? 'Edit' : 'Create' },
        ]}
      />

      <GlossaryEditorForm
        title="Details"
        description={
          isEditMode
            ? `Update terminology routing for ${glossary?.name ?? 'this glossary'}.`
            : 'Create a glossary to protect preferred terms before and after AI translation.'
        }
        languagesData={languagesData}
        formValues={formValues}
        isLoading={isLoading}
        isSaving={isSaving}
        onFieldChange={handleFieldChange}
        onSave={handleSaveGlossary}
      />

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
