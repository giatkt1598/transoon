import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { ProjectDetailInformationSection } from '../project-management/components/project-detail-information-section'
import { ProjectDetailTranslationMemoriesSection } from '../project-management/components/project-detail-translation-memories-section'
import { useProjectDetail } from '../project-management/hooks/use-project-detail'

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const {
    projectDetail,
    availableTranslationMemories,
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
      />

      <Box className="detail-tabs-shell">
        <Tabs value={activeTab} onChange={handleTabChange} className="detail-tabs" variant="scrollable">
          <Tab label="Project Home" />
          <Tab label="Translations" />
        </Tabs>
      </Box>

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
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
        <Box className="empty-state detail-translations-placeholder">
          <Typography component="p">Translations tab is ready for the next implementation step.</Typography>
        </Box>
      )}
    </Box>
  )
}
