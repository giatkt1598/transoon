import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { TranslationMemoryTermsTable } from '../translation-memory-management/components/translation-memory-terms-table'
import { useTranslationMemoryDetails } from '../translation-memory-management/hooks/use-translation-memory-details'

function formatDateTime(value: string | null) {
  if (!value) {
    return {
      date: 'Never used',
      time: 'No activity yet',
    }
  }

  const date = new Date(value)
  return {
    date: date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

export function TranslationMemoryDetailPage() {
  const { translationMemoryId } = useParams()
  const {
    languagesData,
    translationMemory,
    formValues,
    terms,
    isLoading,
    isSaving,
    savingTermIds,
    error,
    handleFieldChange,
    handleSaveTranslationMemory,
    handleTermDraftChange,
    handleTermBlur,
  } = useTranslationMemoryDetails({ translationMemoryId })
  const lastModified = formatDateTime(translationMemory?.lastModifiedAt ?? null)
  const lastUsed = formatDateTime(translationMemory?.lastUsedAt ?? null)

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={translationMemory?.name ?? 'Translation memory details'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Translation Memories', to: '/translation-memories' },
          { label: translationMemory?.name ?? 'Details' },
        ]}
        actionLabel="Save"
        onActionClick={() => void handleSaveTranslationMemory()}
        actionDisabled={isLoading || isSaving}
      />

      {isLoading ? (
        <Box className="empty-state">
          <Typography component="p">Loading translation memory detail...</Typography>
        </Box>
      ) : (
        <Box className="detail-home-grid">
          <Box className="detail-section-card">
            <Box className="project-editor-section-head">
              <Box>
                <Typography component="h2" className="project-editor-title">
                  Details
                </Typography>
                <Typography component="p" className="project-editor-copy">
                  Update metadata and language routing for {translationMemory?.name ?? 'this translation memory'}.
                </Typography>
              </Box>
            </Box>

            <Box className="project-editor-form">
              <Box className="detail-description-block">
                <Typography component="span">Translation memory name</Typography>
                <TextField
                  fullWidth
                  value={formValues.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  placeholder="Consumer electronics EN -> JA"
                  disabled={isSaving}
                  sx={{ mt: 1.5 }}
                />
              </Box>

              <Box className="detail-info-grid">
                <Box className="detail-info-item">
                  <Typography component="span">Source language</Typography>
                  <TextField
                    select
                    fullWidth
                    value={formValues.sourceLanguage}
                    onChange={(event) => handleFieldChange('sourceLanguage', event.target.value)}
                    disabled={isSaving}
                    sx={{ mt: 1.5 }}
                  >
                    {languagesData.languages.map((language) => (
                      <MenuItem key={language.code} value={language.code}>
                        {language.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box className="detail-info-item">
                  <Typography component="span">Target language</Typography>
                  <TextField
                    select
                    fullWidth
                    value={formValues.targetLanguage}
                    onChange={(event) => handleFieldChange('targetLanguage', event.target.value)}
                    disabled={isSaving}
                    sx={{ mt: 1.5 }}
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

                <Box className="detail-info-item">
                  <Typography component="span">Last modified</Typography>
                  <Typography component="strong">{lastModified.date}</Typography>
                  <Typography component="p">{lastModified.time}</Typography>
                </Box>

                <Box className="detail-info-item">
                  <Typography component="span">Last used</Typography>
                  <Typography component="strong">{lastUsed.date}</Typography>
                  <Typography component="p">{lastUsed.time}</Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          <Box className="detail-section-card">
            <Box className="project-editor-section-head">
              <Box>
                <Typography component="h2" className="project-editor-title">
                  Terms
                </Typography>
                <Typography component="p" className="project-editor-copy">
                  Edit terms directly in the table. Changes are saved when a cell loses focus.
                </Typography>
              </Box>
            </Box>

            <Box className="project-editor-form">
              <TranslationMemoryTermsTable
                terms={terms}
                isLoading={isLoading}
                savingTermIds={savingTermIds}
                onTermDraftChange={handleTermDraftChange}
                onTermBlur={handleTermBlur}
              />
            </Box>
          </Box>
        </Box>
      )}

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
