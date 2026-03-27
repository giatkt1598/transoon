import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import { GlossaryItemsTable } from '../glossary-management/components/glossary-items-table'
import { useGlossaryDetails } from '../glossary-management/hooks/use-glossary-details'
import { ProjectPageHeader } from '../project-management/components/project-page-header'

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

export function GlossaryDetailPage() {
  const { glossaryId } = useParams()
  const {
    languagesData,
    glossary,
    formValues,
    items,
    newItemDraft,
    isLoading,
    isSaving,
    savingItemIds,
    deletingItemIds,
    error,
    handleFieldChange,
    handleSaveGlossary,
    handleGlossaryItemDraftChange,
    handleGlossaryItemBlur,
    handleNewItemDraftChange,
    handleCreateGlossaryItem,
    handleDeleteGlossaryItem,
  } = useGlossaryDetails({ glossaryId })
  const lastModified = formatDateTime(glossary?.lastModifiedAt ?? null)
  const lastUsed = formatDateTime(glossary?.lastUsedAt ?? null)

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={glossary?.name ?? 'Glossary details'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Glossaries', to: '/glossaries' },
          { label: glossary?.name ?? 'Details' },
        ]}
        actionLabel="Save"
        onActionClick={() => void handleSaveGlossary()}
        actionDisabled={isLoading || isSaving}
      />

      {isLoading ? (
        <Box className="empty-state">
          <Typography component="p">Loading glossary detail...</Typography>
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
                  Update metadata and language routing for {glossary?.name ?? 'this glossary'}.
                </Typography>
              </Box>
            </Box>

            <Box className="project-editor-form">
              <Box className="detail-description-block">
                <Typography component="span">Glossary name</Typography>
                <TextField
                  fullWidth
                  value={formValues.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  placeholder="Game UI EN -> VI"
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
                  Glossary items
                </Typography>
                <Typography component="p" className="project-editor-copy">
                  Items are applied before and after AI translation to protect preferred terminology.
                </Typography>
              </Box>
            </Box>

            <Box className="project-editor-form" sx={{ gap: 3 }}>
              <Box className="project-editor-grid" sx={{ gridTemplateColumns: '1.2fr 1.2fr 120px 120px 120px auto' }}>
                <TextField
                  label="Source"
                  value={newItemDraft.source}
                  onChange={(event) => handleNewItemDraftChange('source', event.target.value)}
                />
                <TextField
                  label="Target"
                  value={newItemDraft.target}
                  onChange={(event) => handleNewItemDraftChange('target', event.target.value)}
                />
                <TextField
                  label="Priority"
                  type="number"
                  value={newItemDraft.priority}
                  onChange={(event) => handleNewItemDraftChange('priority', Number(event.target.value))}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newItemDraft.caseSensitive}
                      onChange={(event) => handleNewItemDraftChange('caseSensitive', event.target.checked)}
                    />
                  }
                  label="Case"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newItemDraft.wholeWord}
                      onChange={(event) => handleNewItemDraftChange('wholeWord', event.target.checked)}
                    />
                  }
                  label="Whole word"
                />
                <Button
                  variant="contained"
                  className="submit-button"
                  onClick={() => void handleCreateGlossaryItem()}
                >
                  Add item
                </Button>
              </Box>

              <GlossaryItemsTable
                items={items}
                isLoading={isLoading}
                savingItemIds={savingItemIds}
                deletingItemIds={deletingItemIds}
                onGlossaryItemDraftChange={handleGlossaryItemDraftChange}
                onGlossaryItemBlur={handleGlossaryItemBlur}
                onDeleteGlossaryItem={handleDeleteGlossaryItem}
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
