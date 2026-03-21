import { Alert, Box, Button, Tab, Tabs, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { AutoTranslateDialog } from '../project-translations/components/auto-translate-dialog'
import { useParams } from 'react-router-dom'
import { AlignmentTool } from '../project-translations/components/alignment-tool'
import { DocumentPreviewPanel } from '../project-translations/components/document-preview-panel'
import { GenerateSegmentsCard } from '../project-translations/components/generate-segments-card'
import {
  resetTranslationsSplitPanePercent,
  TranslationsSplitPane,
} from '../project-translations/components/translations-split-pane'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { ProjectDetailInformationSection } from '../project-management/components/project-detail-information-section'
import { ProjectDetailTranslationMemoriesSection } from '../project-management/components/project-detail-translation-memories-section'
import { useProjectDetail } from '../project-management/hooks/use-project-detail'
import { useProjectDocumentPreview } from '../project-translations/hooks/use-project-document-preview'
import { useProjectTranslations } from '../project-translations/hooks/use-project-translations'
import { getLanguageLabel } from '../app/utils'

const PREVIEW_VISIBILITY_STORAGE_KEY = 'transoon.projectTranslations.previewVisible'

export function ProjectDetailPage() {
  const [isPreviewVisible, setIsPreviewVisible] = useState(() => loadPreviewVisibility())
  const { projectId } = useParams()
  const {
    projectDetail,
    setProjectDetail,
    availableTranslationMemories,
    translateProviders,
    draftTranslationMemories,
    hasPendingTranslationMemoryChanges,
    configForm,
    isConfigDialogOpen,
    editingConfigId,
    draggedTranslationMemoryId,
    activeTab,
    isLoading,
    isSaving,
    error,
    handleTabChange,
    handleConfigFieldChange,
    handleOpenAddDialog,
    handleOpenEditDialog,
    handleCloseConfigDialog,
    handleAddTranslationMemory,
    handleDeleteConfig,
    handleAccessModeChange,
    handleDragStart,
    handleDragEnd,
    handleDropOnRow,
    handleSaveTranslationMemories,
  } = useProjectDetail({ projectId })
  const {
    segments,
    hasSegments,
    isReadOnly,
    isLoadingSegments,
    isGeneratingSegments,
    isSavingSegments,
    isExportingDocument,
    segmentSaveRevision,
    activeSegmentExternalId,
    isAutoTranslateDialogOpen,
    isStartingAutoTranslate,
    isCancellingAutoTranslate,
    selectedProviderName,
    segmentsError,
    hasPendingSegmentChanges,
    inlineTranslatingSegmentId,
    inlineTranslateProviderName,
    inlineCaretRestoreSegmentId,
    inlineCaretRestoreToken,
    setSelectedProviderName,
    handleTargetChange,
    handleActiveSegmentChange,
    handleInlineTranslateSegment,
    handleSaveSegments,
    handleExportDocument,
    handleGenerateSegments,
    handleOpenAutoTranslateDialog,
    handleCloseAutoTranslateDialog,
    handleConfirmAutoTranslate,
    handleCancelAutoTranslate,
  } = useProjectTranslations({
    projectId,
    projectDetail,
    translateProviders,
    isActive: activeTab === 1,
    onProjectDetailChange: setProjectDetail,
  })
  const {
    preview,
    isLoadingPreview,
    previewError,
  } = useProjectDocumentPreview({
    projectId,
    documentFileName: projectDetail?.documentFileName,
    isActive: activeTab === 1,
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(PREVIEW_VISIBILITY_STORAGE_KEY, JSON.stringify(isPreviewVisible))
    } catch {
      // ignore storage write failures
    }
  }, [isPreviewVisible])

  const handleShowPreview = () => {
    resetTranslationsSplitPanePercent()
    setIsPreviewVisible(true)
  }

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={projectDetail?.name ?? 'Project detail'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Projects', to: '/projects' },
          { label: 'Detail' },
        ]}
      />

      <Box className="detail-tabs-shell">
        <Tabs value={activeTab} onChange={handleTabChange} className="detail-tabs" variant="scrollable">
          <Tab label="Project Home" />
          <Tab label="Translations" />
        </Tabs>
      </Box>

      {error || segmentsError ? (
        <Typography component="p" className="status error">
          {error ?? segmentsError}
        </Typography>
      ) : null}

      {projectDetail?.status === 'auto-translate-processing' ? (
        <Alert
          severity="warning"
          className="project-processing-warning"
          action={
            <Button
              type="button"
              variant="text"
              className="project-processing-cancel"
              disabled={isCancellingAutoTranslate}
              onClick={() => void handleCancelAutoTranslate()}
            >
              {isCancellingAutoTranslate ? 'Cancelling...' : 'Cancel'}
            </Button>
          }
        >
          This project is running auto translate in the background. Manual editing is temporarily disabled until the
          job finishes.
        </Alert>
      ) : null}

      {isLoading || !projectDetail ? (
        <Box className="empty-state">
          <Typography component="p">Loading project detail...</Typography>
        </Box>
      ) : activeTab === 0 ? (
        <Box className="detail-home-grid">
          <ProjectDetailInformationSection projectDetail={projectDetail} />
          <ProjectDetailTranslationMemoriesSection
            projectDetail={projectDetail}
            translationMemories={draftTranslationMemories}
            availableTranslationMemories={availableTranslationMemories}
            configForm={configForm}
            isConfigDialogOpen={isConfigDialogOpen}
            editingConfigId={editingConfigId}
            hasPendingChanges={hasPendingTranslationMemoryChanges}
            draggedTranslationMemoryId={draggedTranslationMemoryId}
            isSaving={isSaving}
            isReadOnly={projectDetail.status === 'auto-translate-processing'}
            onFieldChange={handleConfigFieldChange}
            onOpenAddDialog={handleOpenAddDialog}
            onOpenEditDialog={handleOpenEditDialog}
            onCloseConfigDialog={handleCloseConfigDialog}
            onAdd={handleAddTranslationMemory}
            onDelete={handleDeleteConfig}
            onAccessModeChange={handleAccessModeChange}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDropOnRow={handleDropOnRow}
            onSaveAll={handleSaveTranslationMemories}
          />
        </Box>
      ) : (
        <Box className="translations-tab-grid">
          {projectDetail.segmentCount > 0 || hasSegments || isLoadingSegments ? (
            isPreviewVisible ? (
              <TranslationsSplitPane
                alignmentPane={
                  <AlignmentTool
                    segments={segments}
                    sourceLanguageLabel={getLanguageLabel(projectDetail.sourceLang)}
                    targetLanguageLabel={getLanguageLabel(projectDetail.targetLang)}
                    isLoading={isLoadingSegments}
                    isReadOnly={isReadOnly}
                    isBusy={isStartingAutoTranslate}
                    isSaving={isSavingSegments}
                    isExporting={isExportingDocument}
                    hasPendingChanges={hasPendingSegmentChanges}
                    activeSegmentExternalId={activeSegmentExternalId}
                    inlineTranslatingSegmentId={inlineTranslatingSegmentId}
                    inlineTranslateProviderName={inlineTranslateProviderName}
                    inlineCaretRestoreSegmentId={inlineCaretRestoreSegmentId}
                    inlineCaretRestoreToken={inlineCaretRestoreToken}
                    isPreviewVisible={isPreviewVisible}
                    restoreScrollKey={segmentSaveRevision}
                    onTargetChange={handleTargetChange}
                    onActiveSegmentChange={handleActiveSegmentChange}
                    onInlineTranslateSegment={handleInlineTranslateSegment}
                    onSaveAll={() => void handleSaveSegments()}
                    onExport={() => void handleExportDocument()}
                    onOpenAutoTranslate={handleOpenAutoTranslateDialog}
                    onShowPreview={handleShowPreview}
                  />
                }
                previewPane={
                  <DocumentPreviewPanel
                    preview={preview}
                    segments={segments}
                    activeSegmentExternalId={activeSegmentExternalId}
                    isLoading={isLoadingPreview}
                    error={previewError}
                    onClose={() => setIsPreviewVisible(false)}
                  />
                }
              />
            ) : (
              <AlignmentTool
                segments={segments}
                sourceLanguageLabel={getLanguageLabel(projectDetail.sourceLang)}
                targetLanguageLabel={getLanguageLabel(projectDetail.targetLang)}
                isLoading={isLoadingSegments}
                isReadOnly={isReadOnly}
                isBusy={isStartingAutoTranslate}
                isSaving={isSavingSegments}
                isExporting={isExportingDocument}
                hasPendingChanges={hasPendingSegmentChanges}
                activeSegmentExternalId={activeSegmentExternalId}
                inlineTranslatingSegmentId={inlineTranslatingSegmentId}
                inlineTranslateProviderName={inlineTranslateProviderName}
                inlineCaretRestoreSegmentId={inlineCaretRestoreSegmentId}
                inlineCaretRestoreToken={inlineCaretRestoreToken}
                isPreviewVisible={isPreviewVisible}
                restoreScrollKey={segmentSaveRevision}
                onTargetChange={handleTargetChange}
                onActiveSegmentChange={handleActiveSegmentChange}
                onInlineTranslateSegment={handleInlineTranslateSegment}
                onSaveAll={() => void handleSaveSegments()}
                onExport={() => void handleExportDocument()}
                onOpenAutoTranslate={handleOpenAutoTranslateDialog}
                onShowPreview={handleShowPreview}
              />
            )
          ) : (
            <GenerateSegmentsCard
              canGenerate={Boolean(projectDetail.documentFileName)}
              isGenerating={isGeneratingSegments}
              onGenerate={() => void handleGenerateSegments()}
            />
          )}
        </Box>
      )}

      <AutoTranslateDialog
        open={isAutoTranslateDialogOpen}
        isSubmitting={isStartingAutoTranslate}
        providerName={selectedProviderName}
        providers={translateProviders}
        onProviderChange={setSelectedProviderName}
        onClose={handleCloseAutoTranslateDialog}
        onConfirm={() => void handleConfirmAutoTranslate()}
      />
    </Box>
  )
}

function loadPreviewVisibility() {
  try {
    const storedValue = window.localStorage.getItem(PREVIEW_VISIBILITY_STORAGE_KEY)
    if (storedValue === null) {
      return true
    }

    const parsedValue = JSON.parse(storedValue)
    return typeof parsedValue === 'boolean' ? parsedValue : true
  } catch {
    return true
  }
}
