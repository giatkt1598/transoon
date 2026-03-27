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
  TextField,
  MenuItem,
  Tab,
  Tabs,
  Typography,
  Tooltip,
} from '@mui/material'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useEffect, useState } from 'react'
import { useBlocker, useParams } from 'react-router-dom'
import type { SortDirection } from '../app/linq'
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
  const [glossaryItemsSearchTerm, setGlossaryItemsSearchTerm] = useState('')
  const [glossaryItemsSortState, setGlossaryItemsSortState] = useState<{
    column: keyof typeof items[number]
    direction: SortDirection
  } | null>({
    column: 'createdAt',
    direction: 'asc',
  })
  const [glossaryItemsPage, setGlossaryItemsPage] = useState(0)
  const [glossaryItemsRowsPerPage, setGlossaryItemsRowsPerPage] = useState(10)
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
  const sourceLanguageLabel =
    languagesData.languages.find((language) => language.code === formValues.sourceLanguage)?.label ??
    formValues.sourceLanguage
  const targetLanguageLabel =
    languagesData.languages.find((language) => language.code === formValues.targetLanguage)?.label ??
    formValues.targetLanguage
  const hasDuplicateNewItemSource = items.some((item) =>
    isDuplicateSourceDraft(
      {
        source: newItemDraft.source,
        caseSensitive: newItemDraft.caseSensitive,
      },
      item,
    ),
  )

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
                    sourceLanguageLabel={sourceLanguageLabel}
                    targetLanguageLabel={targetLanguageLabel}
                    searchTerm={glossaryItemsSearchTerm}
                    onSearchChange={setGlossaryItemsSearchTerm}
                    sortState={glossaryItemsSortState}
                    onSortChange={setGlossaryItemsSortState}
                    page={glossaryItemsPage}
                    rowsPerPage={glossaryItemsRowsPerPage}
                    onPageChange={setGlossaryItemsPage}
                    onRowsPerPageChange={setGlossaryItemsRowsPerPage}
                    onGlossaryItemDraftChange={handleGlossaryItemDraftChange}
                    onGlossaryItemBlur={handleGlossaryItemBlur}
                    onDeleteGlossaryItem={handleDeleteGlossaryItem}
                  />

                  <Box className="project-editor-grid" sx={{ gridTemplateColumns: '1.2fr 1.2fr auto 120px auto' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: hasDuplicateNewItemSource ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 1, alignItems: 'center' }}>
                      {hasDuplicateNewItemSource ? (
                        <Tooltip title="Another glossary item already matches this source. Duplicate matching can cause ambiguity.">
                          <WarningAmberRoundedIcon fontSize="small" color="warning" />
                        </Tooltip>
                      ) : null}
                      <TextField
                        label={`Source (${sourceLanguageLabel})`}
                        value={newItemDraft.source}
                        onChange={(event) => handleNewItemDraftChange('source', event.target.value)}
                      />
                    </Box>
                    <TextField
                      label={`Target (${targetLanguageLabel})`}
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
                    <Button
                      variant="contained"
                      className="submit-button"
                      onClick={async () => {
                        const didCreateGlossaryItem = await handleCreateGlossaryItem()
                        if (!didCreateGlossaryItem) {
                          return
                        }

                        setGlossaryItemsSearchTerm('')
                        setGlossaryItemsSortState({
                          column: 'createdAt',
                          direction: 'asc',
                        })
                        setGlossaryItemsPage(
                          Math.max(0, Math.ceil((items.length + 1) / glossaryItemsRowsPerPage) - 1),
                        )
                      }}
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

function isDuplicateSourceDraft(
  draft: { source: string; caseSensitive: boolean },
  item: { source: string; caseSensitive: boolean },
) {
  const draftSource = draft.source.trim()
  const itemSource = item.source.trim()

  if (!draftSource || !itemSource) {
    return false
  }

  if (draftSource === itemSource) {
    return true
  }

  return (
    draftSource.toLocaleLowerCase() === itemSource.toLocaleLowerCase() &&
    (!draft.caseSensitive || !item.caseSensitive)
  )
}
