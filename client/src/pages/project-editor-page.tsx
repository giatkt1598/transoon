import { Box, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { ProjectEditorForm } from '../project-management/components/project-editor-form'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { useProjectEditor } from '../project-management/hooks/use-project-editor'

export function ProjectEditorPage() {
  const { projectId } = useParams()
  const {
    languagesData,
    project,
    formValues,
    documentFile,
    isEditMode,
    isReadOnly,
    isLoading,
    isSaving,
    error,
    handleFieldChange,
    handleDocumentFileChange,
    handleSaveProject,
  } = useProjectEditor({ projectId })

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={isEditMode ? 'Edit project' : 'Create a new project'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Projects', to: '/projects' },
          { label: isEditMode ? 'Edit' : 'Create' },
        ]}
      />

      <ProjectEditorForm
        title="Details"
        description={
          isEditMode
            ? `Update workspace information, language routing, and metadata for ${project?.name ?? 'this project'}.`
            : 'Set up workspace information now, then connect documents and translation memory in the next steps.'
        }
        languagesData={languagesData}
        formValues={formValues}
        documentFileName={documentFile?.name ?? project?.documentFileName ?? ''}
        showDocumentWarning={!isEditMode && Boolean(documentFile)}
        isEditMode={isEditMode}
        isReadOnly={isReadOnly}
        isLoading={isLoading}
        isSaving={isSaving}
        onFieldChange={handleFieldChange}
        onDocumentFileChange={handleDocumentFileChange}
        onSave={handleSaveProject}
      />

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
