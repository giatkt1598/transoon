import { Alert, Box, Tab, Tabs, Typography } from '@mui/material'
import { AutoTranslateDialog } from '../project-translations/components/auto-translate-dialog'
import { useParams } from 'react-router-dom'
import { AlignmentTool } from '../project-translations/components/alignment-tool'
import { DocumentPreviewPlaceholder } from '../project-translations/components/document-preview-placeholder'
import { GenerateSegmentsCard } from '../project-translations/components/generate-segments-card'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { ProjectDetailInformationSection } from '../project-management/components/project-detail-information-section'
import { ProjectDetailTranslationMemoriesSection } from '../project-management/components/project-detail-translation-memories-section'
import { useProjectDetail } from '../project-management/hooks/use-project-detail'
import { useProjectTranslations } from '../project-translations/hooks/use-project-translations'

export function ProjectDetailPage() {
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
    isAutoTranslateDialogOpen,
    isStartingAutoTranslate,
    selectedProviderName,
    segmentsError,
    setSelectedProviderName,
    handleTargetChange,
    handleGenerateSegments,
    handleOpenAutoTranslateDialog,
    handleCloseAutoTranslateDialog,
    handleConfirmAutoTranslate,
  } = useProjectTranslations({
    projectId,
    projectDetail,
    translateProviders,
    isActive: activeTab === 1,
    onProjectDetailChange: setProjectDetail,
  })

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={projectDetail?.name ?? 'Project detail'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Projects', to: '/projects' },
          { label: 'Detail' },
        ]}
        actionLabel="Edit project"
        actionTo={projectId ? `/projects/${projectId}/edit` : '/projects'}
        actionDisabled={projectDetail?.status === 'auto-translate-processing'}
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
        <Alert severity="warning" className="project-processing-warning">
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
            <>
              <AlignmentTool
                segments={segments}
                isLoading={isLoadingSegments}
                isReadOnly={isReadOnly}
                isBusy={isStartingAutoTranslate}
                onTargetChange={handleTargetChange}
                onOpenAutoTranslate={handleOpenAutoTranslateDialog}
              />
              <DocumentPreviewPlaceholder />
            </>
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
