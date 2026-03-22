import { Alert, Box, Button, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { AutoTranslateDialog } from "../project-translations/components/auto-translate-dialog";
import { useBlocker, useParams } from "react-router-dom";
import { AlignmentTool } from "../project-translations/components/alignment-tool";
import { DocumentPreviewPanel } from "../project-translations/components/document-preview-panel";
import { GenerateSegmentsCard } from "../project-translations/components/generate-segments-card";
import {
  resetTranslationsSplitPanePercent,
  TranslationsSplitPane,
} from "../project-translations/components/translations-split-pane";
import { ProjectPageHeader } from "../project-management/components/project-page-header";
import { ProjectDetailInformationSection } from "../project-management/components/project-detail-information-section";
import { ProjectDetailTranslationMemoriesSection } from "../project-management/components/project-detail-translation-memories-section";
import { useProjectDetail } from "../project-management/hooks/use-project-detail";
import { useProjectDocumentPreview } from "../project-translations/hooks/use-project-document-preview";
import { useProjectTermsPreload } from "../project-translations/hooks/use-project-terms-preload";
import { useProjectTranslations } from "../project-translations/hooks/use-project-translations";
import { getLanguageLabel } from "../app/utils";

const PREVIEW_VISIBILITY_STORAGE_KEY =
  "transoon.projectTranslations.previewVisible";
const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes on this project. Do you want to leave this page? Your changes will not be saved.";

export function ProjectDetailPage() {
  const [isPreviewVisible, setIsPreviewVisible] = useState(() =>
    loadPreviewVisibility(),
  );
  const flushPendingTranslationDraftsRef = useRef<(() => void) | null>(null);
  const { projectId } = useParams();
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
  } = useProjectDetail({ projectId });
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
    confirmingSegmentId,
    inlineTranslateProviderName,
    inlineCaretRestoreSegmentId,
    inlineCaretRestoreToken,
    confirmFocusSegmentId,
    confirmFocusToken,
    setSelectedProviderName,
    handleTargetChange,
    handleActiveSegmentChange,
    handleInlineTranslateSegment,
    handleConfirmSegment,
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
    onProjectDetailChange: setProjectDetail,
  });
  const hasUnsavedChanges =
    hasPendingTranslationMemoryChanges || hasPendingSegmentChanges;
  const navigationBlocker = useBlocker(hasUnsavedChanges);
  const { preview, isLoadingPreview, previewError } = useProjectDocumentPreview(
    {
      projectId,
      documentFileName: projectDetail?.documentFileName,
    },
  );
  const { projectTerms } = useProjectTermsPreload({ projectId });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PREVIEW_VISIBILITY_STORAGE_KEY,
        JSON.stringify(isPreviewVisible),
      );
    } catch {
      // ignore storage write failures
    }
  }, [isPreviewVisible]);

  useEffect(() => {
    if (navigationBlocker.state !== "blocked") {
      return;
    }

    const shouldLeave = window.confirm(UNSAVED_CHANGES_MESSAGE);
    if (shouldLeave) {
      navigationBlocker.proceed();
      return;
    }

    navigationBlocker.reset();
  }, [navigationBlocker]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (activeTab !== 1 || !event.ctrlKey || event.code !== "KeyS") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      flushPendingTranslationDraftsRef.current?.();
      void handleSaveSegments();
    };

    window.addEventListener("keydown", handleWindowKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, {
        capture: true,
      });
    };
  }, [activeTab, handleSaveSegments]);

  const handleShowPreview = () => {
    resetTranslationsSplitPanePercent();
    setIsPreviewVisible(true);
  };

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={projectDetail?.name ?? "Project detail"}
        breadcrumbs={[
          { label: "Dashboard", to: "/" },
          { label: "Projects", to: "/projects" },
          { label: "Detail" },
        ]}
      />

      <Box className="detail-tabs-shell">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          className="detail-tabs"
          variant="scrollable"
        >
          <Tab label="Project Home" />
          <Tab label="Translations" />
        </Tabs>
      </Box>

      {error || segmentsError ? (
        <Typography component="p" className="status error">
          {error ?? segmentsError}
        </Typography>
      ) : null}

      {projectDetail?.status === "auto-translate-processing" ? (
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
              {isCancellingAutoTranslate ? "Cancelling..." : "Cancel"}
            </Button>
          }
        >
          This project is running auto translate in the background. Manual
          editing is temporarily disabled until the job finishes.
        </Alert>
      ) : null}

      {isLoading || !projectDetail ? (
        <Box className="empty-state">
          <Typography component="p">Loading project detail...</Typography>
        </Box>
      ) : (
        <>
          <Box
            className={
              activeTab === 0
                ? "detail-tab-panel"
                : "detail-tab-panel detail-tab-panel-hidden"
            }
          >
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
                isReadOnly={
                  projectDetail.status === "auto-translate-processing"
                }
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
          </Box>

          <Box
            className={
              activeTab === 1
                ? "detail-tab-panel"
                : "detail-tab-panel detail-tab-panel-hidden"
            }
          >
            <Box className="translations-tab-grid">
              {projectDetail.segmentCount > 0 ||
              hasSegments ||
              isLoadingSegments ? (
                isPreviewVisible ? (
                  <TranslationsSplitPane
                    alignmentPane={
                      <AlignmentTool
                        segments={segments}
                        sourceLanguageLabel={getLanguageLabel(
                          projectDetail.sourceLang,
                        )}
                        targetLanguageLabel={getLanguageLabel(
                          projectDetail.targetLang,
                        )}
                        isLoading={isLoadingSegments}
                        isReadOnly={isReadOnly}
                        isBusy={isStartingAutoTranslate}
                        isSaving={isSavingSegments}
                        isExporting={isExportingDocument}
                        hasPendingChanges={hasPendingSegmentChanges}
                        activeSegmentExternalId={activeSegmentExternalId}
                        inlineTranslatingSegmentId={inlineTranslatingSegmentId}
                        confirmingSegmentId={confirmingSegmentId}
                        inlineTranslateProviderName={
                          inlineTranslateProviderName
                        }
                        inlineCaretRestoreSegmentId={
                          inlineCaretRestoreSegmentId
                        }
                        inlineCaretRestoreToken={inlineCaretRestoreToken}
                        confirmFocusSegmentId={confirmFocusSegmentId}
                        confirmFocusToken={confirmFocusToken}
                        projectTerms={projectTerms}
                        isPreviewVisible={isPreviewVisible}
                        restoreScrollKey={segmentSaveRevision}
                        onRegisterFlushPendingChanges={(
                          flushPendingChanges,
                        ) => {
                          flushPendingTranslationDraftsRef.current =
                            flushPendingChanges;
                        }}
                        onTargetChange={handleTargetChange}
                        onActiveSegmentChange={handleActiveSegmentChange}
                        onInlineTranslateSegment={handleInlineTranslateSegment}
                        onConfirmSegment={handleConfirmSegment}
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
                    sourceLanguageLabel={getLanguageLabel(
                      projectDetail.sourceLang,
                    )}
                    targetLanguageLabel={getLanguageLabel(
                      projectDetail.targetLang,
                    )}
                    isLoading={isLoadingSegments}
                    isReadOnly={isReadOnly}
                    isBusy={isStartingAutoTranslate}
                    isSaving={isSavingSegments}
                    isExporting={isExportingDocument}
                    hasPendingChanges={hasPendingSegmentChanges}
                    activeSegmentExternalId={activeSegmentExternalId}
                    inlineTranslatingSegmentId={inlineTranslatingSegmentId}
                    confirmingSegmentId={confirmingSegmentId}
                    inlineTranslateProviderName={inlineTranslateProviderName}
                    inlineCaretRestoreSegmentId={inlineCaretRestoreSegmentId}
                    inlineCaretRestoreToken={inlineCaretRestoreToken}
                    confirmFocusSegmentId={confirmFocusSegmentId}
                    confirmFocusToken={confirmFocusToken}
                    projectTerms={projectTerms}
                    isPreviewVisible={isPreviewVisible}
                    restoreScrollKey={segmentSaveRevision}
                    onRegisterFlushPendingChanges={(flushPendingChanges) => {
                      flushPendingTranslationDraftsRef.current =
                        flushPendingChanges;
                    }}
                    onTargetChange={handleTargetChange}
                    onActiveSegmentChange={handleActiveSegmentChange}
                    onInlineTranslateSegment={handleInlineTranslateSegment}
                    onConfirmSegment={handleConfirmSegment}
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
          </Box>
        </>
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
  );
}

function loadPreviewVisibility() {
  try {
    const storedValue = window.localStorage.getItem(
      PREVIEW_VISIBILITY_STORAGE_KEY,
    );
    if (storedValue === null) {
      return true;
    }

    const parsedValue = JSON.parse(storedValue);
    return typeof parsedValue === "boolean" ? parsedValue : true;
  } catch {
    return true;
  }
}
