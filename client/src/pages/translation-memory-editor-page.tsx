import { Box, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { TranslationMemoryEditorForm } from '../translation-memory-management/components/translation-memory-editor-form'
import { useTranslationMemoryEditor } from '../translation-memory-management/hooks/use-translation-memory-editor'

export function TranslationMemoryEditorPage() {
  const { translationMemoryId } = useParams()
  const {
    languagesData,
    translationMemory,
    formValues,
    isEditMode,
    isLoading,
    isSaving,
    error,
    handleFieldChange,
    handleSaveTranslationMemory,
  } = useTranslationMemoryEditor({ translationMemoryId })

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={isEditMode ? 'Edit translation memory' : 'Create a new translation memory'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Translation Memories', to: '/translation-memories' },
          { label: isEditMode ? 'Edit' : 'Create' },
        ]}
      />

      <TranslationMemoryEditorForm
        title="Details"
        description={
          isEditMode
            ? `Update metadata and language routing for ${translationMemory?.name ?? 'this translation memory'}.`
            : 'Create a reusable term base for future lookup, project attachment, and glossary enforcement.'
        }
        languagesData={languagesData}
        formValues={formValues}
        isLoading={isLoading}
        isSaving={isSaving}
        onFieldChange={handleFieldChange}
        onSave={handleSaveTranslationMemory}
      />

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
