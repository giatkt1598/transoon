import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import { useEffect, useState } from 'react'
import { useBlocker, useParams } from 'react-router-dom'
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

const UNSAVED_CHANGES_MESSAGE =
  'You have unsaved changes in this glossary. Do you want to leave this page? Your changes will not be saved.'

export function GlossaryDetailPage() {
  const [isCaseSensitiveHelpOpen, setIsCaseSensitiveHelpOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(1)
  const { glossaryId } = useParams()
  const {
    languagesData,
    glossary,
    formValues,
    items,
    newItemDraft,
    isLoading,
    isSaving,
    hasPendingChanges,
    error,
    handleFieldChange,
    handleSaveGlossary,
    handleGlossaryItemDraftChange,
    handleGlossaryItemBlur,
    handleNewItemDraftChange,
    handleCreateGlossaryItem,
    handleDeleteGlossaryItem,
  } = useGlossaryDetails({ glossaryId })
  const navigationBlocker = useBlocker(hasPendingChanges)
  const lastModified = formatDateTime(glossary?.lastModifiedAt ?? null)
  const lastUsed = formatDateTime(glossary?.lastUsedAt ?? null)

  useEffect(() => {
    if (navigationBlocker.state !== 'blocked') {
      return
    }

    const shouldLeave = window.confirm(UNSAVED_CHANGES_MESSAGE)
    if (shouldLeave) {
      navigationBlocker.proceed()
      return
    }

    navigationBlocker.reset()
  }, [navigationBlocker])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingChanges) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasPendingChanges])

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

      <Box className="detail-tabs-shell">
        <Tabs
          value={activeTab}
          onChange={(_event, value) => setActiveTab(value)}
          className="detail-tabs"
          variant="scrollable"
        >
          <Tab label="Details" />
          <Tab label="Glossary items" />
        </Tabs>
      </Box>

      {isLoading ? (
        <Box className="empty-state">
          <Typography component="p">Loading glossary detail...</Typography>
        </Box>
      ) : (
        <>
          <Box
            className={
              activeTab === 0
                ? 'detail-tab-panel'
                : 'detail-tab-panel detail-tab-panel-hidden'
            }
          >
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
            </Box>
          </Box>

          <Box
            className={
              activeTab === 1
                ? 'detail-tab-panel'
                : 'detail-tab-panel detail-tab-panel-hidden'
            }
          >
            <Box className="detail-home-grid">
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
                  <GlossaryItemsTable
                    items={items}
                    isLoading={isLoading}
                    onGlossaryItemDraftChange={handleGlossaryItemDraftChange}
                    onGlossaryItemBlur={handleGlossaryItemBlur}
                    onDeleteGlossaryItem={handleDeleteGlossaryItem}
                  />

                  <Box className="project-editor-grid" sx={{ gridTemplateColumns: '1.2fr 1.2fr auto 120px auto' }}>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={newItemDraft.caseSensitive}
                            onChange={(event) => handleNewItemDraftChange('caseSensitive', event.target.checked)}
                          />
                        }
                        label="Case sensitive"
                        sx={{ m: 0 }}
                      />
                      <IconButton
                        size="small"
                        aria-label="Explain case sensitive glossary matching"
                        onClick={() => setIsCaseSensitiveHelpOpen(true)}
                      >
                        <HelpOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <TextField
                      label="Priority"
                      type="number"
                      value={newItemDraft.priority}
                      onChange={(event) => handleNewItemDraftChange('priority', Number(event.target.value))}
                    />
                    <Button
                      variant="contained"
                      className="submit-button"
                      onClick={() => void handleCreateGlossaryItem()}
                    >
                      Add item
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}

      <Dialog
        open={isCaseSensitiveHelpOpen}
        onClose={() => setIsCaseSensitiveHelpOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Case sensitive matching</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography component="p">
              When <strong>Case sensitive</strong> is enabled, the glossary item only matches text with the exact same uppercase and lowercase letters.
            </Typography>
            <Typography component="p">
              Example 1: glossary source <strong>Apple</strong> matches <strong>Apple</strong>, but it does not match <strong>apple</strong>.
            </Typography>
            <Typography component="p">
              Example 2: glossary source <strong>HP</strong> matches <strong>HP</strong>, but it does not match <strong>hp</strong>.
            </Typography>
            <Typography component="p">
              Leave it unchecked when the term should match regardless of letter case.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setIsCaseSensitiveHelpOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
