import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { LanguagesResponse } from '../../app/types'
import { ProjectDocumentUploadField } from './project-document-upload-field'
import type { ProjectFormValues } from '../types'

type ProjectEditorFormProps = {
  title: string
  description: string
  languagesData: LanguagesResponse
  formValues: ProjectFormValues
  documentFileName: string
  showDocumentWarning: boolean
  isEditMode: boolean
  isReadOnly: boolean
  isLoading: boolean
  isSaving: boolean
  onFieldChange: <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => void
  onDocumentFileChange: (file: File | null) => void
  onSave: () => Promise<void>
}

export function ProjectEditorForm({
  title,
  description,
  languagesData,
  formValues,
  documentFileName,
  showDocumentWarning,
  isEditMode,
  isReadOnly,
  isLoading,
  isSaving,
  onFieldChange,
  onDocumentFileChange,
  onSave,
}: ProjectEditorFormProps) {
  return (
    <Paper className="project-editor-shell" elevation={0}>
      <Box className="project-editor-section-head">
        <Box>
          <Typography component="h2" className="project-editor-title">
            {title}
          </Typography>
          <Typography component="p" className="project-editor-copy">
            {description}
          </Typography>
        </Box>
      </Box>

      <Box className="project-editor-form">
        {isReadOnly ? (
          <Alert severity="warning" className="project-document-warning">
            This project is currently running auto translate. Manual edits are temporarily disabled until the background
            job finishes.
          </Alert>
        ) : null}

        <TextField
          label="Project name"
          value={formValues.name}
          onChange={(event) => onFieldChange('name', event.target.value)}
          placeholder="Panasonic manuals, EN -> JA"
          fullWidth
          disabled={isLoading || isSaving || isReadOnly}
        />

        <TextField
          label="Description"
          value={formValues.description}
          onChange={(event) => onFieldChange('description', event.target.value)}
          placeholder="Project notes, scope, reviewer guidance, or terminology hints"
          fullWidth
          multiline
          minRows={4}
          disabled={isLoading || isSaving || isReadOnly}
        />

        <ProjectDocumentUploadField
          value={documentFileName}
          disabled={isEditMode || isLoading || isSaving || isReadOnly}
          onFileChange={onDocumentFileChange}
        />

        {showDocumentWarning ? (
          <Alert severity="warning" className="project-document-warning">
            After the project is created, the uploaded document cannot be changed from the edit screen.
          </Alert>
        ) : null}

        <Box className="project-editor-grid">
          <TextField
            select
            label="Source language"
            value={formValues.sourceLang}
            onChange={(event) => onFieldChange('sourceLang', event.target.value)}
            disabled={isLoading || isSaving || isReadOnly}
          >
            {languagesData.languages.map((language) => (
              <MenuItem key={language.code} value={language.code}>
                {language.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Target language"
            value={formValues.targetLang}
            onChange={(event) => onFieldChange('targetLang', event.target.value)}
            disabled={isLoading || isSaving || isReadOnly}
          >
            {languagesData.languages
              .filter((language) => language.code !== 'auto')
              .map((language) => (
                <MenuItem key={language.code} value={language.code}>
                  {language.label}
                </MenuItem>
              ))}
          </TextField>
        </Box>
      </Box>

      <Box className="project-editor-actions">
        <Button
          component={RouterLink}
          to="/projects"
          variant="outlined"
          className="secondary-button"
          startIcon={<ArrowBackRoundedIcon />}
        >
          Back to list
        </Button>

        <Button
          variant="contained"
          className="submit-button"
          onClick={() => void onSave()}
          disabled={isLoading || isSaving || isReadOnly}
        >
          {isSaving ? 'Saving project...' : isEditMode ? 'Save project' : 'Create project'}
        </Button>
      </Box>
    </Paper>
  )
}
