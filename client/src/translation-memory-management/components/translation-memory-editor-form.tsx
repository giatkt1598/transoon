import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { LanguagesResponse } from '../../app/types'
import { LanguageSwapButton } from '../../components/language-swap-button'
import type { TranslationMemoryFormValues } from '../types'

type TranslationMemoryEditorFormProps = {
  title: string
  description: string
  languagesData: LanguagesResponse
  formValues: TranslationMemoryFormValues
  isLoading: boolean
  isSaving: boolean
  onFieldChange: <K extends keyof TranslationMemoryFormValues>(
    field: K,
    value: TranslationMemoryFormValues[K],
  ) => void
  onSave: () => Promise<void>
}

export function TranslationMemoryEditorForm({
  title,
  description,
  languagesData,
  formValues,
  isLoading,
  isSaving,
  onFieldChange,
  onSave,
}: TranslationMemoryEditorFormProps) {
  return (
    <Paper className="project-editor-shell project-editor-shell-narrow" elevation={0}>
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
        <TextField
          label="Translation memory name"
          value={formValues.name}
          onChange={(event) => onFieldChange('name', event.target.value)}
          placeholder="Consumer electronics EN -> JA"
          fullWidth
          disabled={isLoading || isSaving}
        />

        <Box className="language-pair-grid">
          <TextField
            select
            label="Source language"
            value={formValues.sourceLanguage}
            onChange={(event) => onFieldChange('sourceLanguage', event.target.value)}
            disabled={isLoading || isSaving}
          >
            {languagesData.languages
              .filter(
                (language) => language.code !== formValues.targetLanguage,
              )
              .map((language) => (
              <MenuItem key={language.code} value={language.code}>
                {language.label}
              </MenuItem>
              ))}
          </TextField>

          <LanguageSwapButton
            disabled={formValues.sourceLanguage === 'auto'}
            disabledReason="Auto detect cannot be used as the target language."
            onClick={() => {
              onFieldChange('sourceLanguage', formValues.targetLanguage)
              onFieldChange('targetLanguage', formValues.sourceLanguage)
            }}
          />

          <TextField
            select
            label="Target language"
            value={formValues.targetLanguage}
            onChange={(event) => onFieldChange('targetLanguage', event.target.value)}
            disabled={isLoading || isSaving}
          >
            {languagesData.languages
              .filter(
                (language) =>
                  language.code !== 'auto' &&
                  language.code !== formValues.sourceLanguage,
              )
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
          to="/translation-memories"
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
          disabled={isLoading || isSaving}
        >
          {isSaving ? 'Saving translation memory...' : 'Save translation memory'}
        </Button>
      </Box>
    </Paper>
  )
}
