import { Alert, Box, Button, Paper, Tab, Tabs, Typography } from "@mui/material";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AutoTranslateDialog } from "../project-translations/components/auto-translate-dialog";
import { useBlocker, useParams, useSearchParams } from "react-router-dom";
import { AlignmentTool } from "../project-translations/components/alignment-tool";
import {
  LoadingPageSkeleton,
  LoadingTableSkeleton,
} from "../components/loading-skeleton";
import { DocumentPreviewPanel } from "../project-translations/components/document-preview-panel";
import { GenerateSegmentsCard } from "../project-translations/components/generate-segments-card";
import {
  resetTranslationsSplitPanePercent,
  TranslationsSplitPane,
} from "../project-translations/components/translations-split-pane";
import { ProjectPageHeader } from "../project-management/components/project-page-header";
import { ProjectDetailInformationSection } from "../project-management/components/project-detail-information-section";
import { ProjectDetailGlossariesSection } from "../project-management/components/project-detail-glossaries-section";
import { ProjectDetailTranslationMemoriesSection } from "../project-management/components/project-detail-translation-memories-section";
import { useProjectDetail } from "../project-management/hooks/use-project-detail";
import { useProjectDocumentPreview } from "../project-translations/hooks/use-project-document-preview";
import { useProjectTermsPreload } from "../project-translations/hooks/use-project-terms-preload";
import {
  PROJECT_TRANSLATION_MEMORY_PROVIDER_NAME,
  useProjectTranslations,
} from "../project-translations/hooks/use-project-translations";
import { fetchProjectDetail } from "../project-management/api";
import { getLanguageLabel } from "../app/utils";

const PREVIEW_VISIBILITY_STORAGE_KEY = "transoon.projectTranslations.previewVisible";
const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes on this project. Do you want to leave this page? Your changes will not be saved.";
const ProjectTranslationSummarySection = lazy(() =>
  import("../project-management/components/project-translation-summary-section"),
);
const PROJECT_DETAIL_TAB_PARAM_KEY = "tab";
const PROJECT_DETAIL_TAB_VALUE_BY_INDEX = ["home", "translations"] as const;

export function ProjectDetailPage() {
  const [isPreviewVisible, setIsPreviewVisible] = useState(() => loadPreviewVisibility());
  const flushPendingTranslationDraftsRef = useRef<(() => void) | null>(null);
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get(PROJECT_DETAIL_TAB_PARAM_KEY);
  const {
    projectDetail,
    setProjectDetail,
    availableTranslationMemories,
    availableGlossaries,
    translateProviders,
    draftTranslationMemories,
    draftGlossaries,
    configForm,
    glossaryConfigForm,
    isConfigDialogOpen,
    isGlossaryDialogOpen,
    editingConfigId,
    draggedTranslationMemoryId,
    draggedGlossaryId,
    activeTab,
    isLoading,
    isSaving,
    error,
    translationResourcesRevision,
    handleRefreshTranslationResources,
    handleTabValueChange,
    handleConfigFieldChange,
    handleGlossaryConfigFieldChange,
    handleOpenAddDialog,
    handleOpenAddGlossaryDialog,
    handleOpenEditDialog,
    handleCloseConfigDialog,
    handleCloseGlossaryDialog,
    handleAddTranslationMemory,
    handleAddGlossary,
    handleDeleteConfig,
    handleDeleteGlossaryConfig,
    handleAccessModeChange,
    handleDragStart,
    handleDragEnd,
    handleDropOnRow,
    handleGlossaryDragStart,
    handleGlossaryDragEnd,
    handleDropGlossaryOnRow,
  } = useProjectDetail({ projectId });
  const { projectTerms, setProjectTerms } = useProjectTermsPreload({
    projectId,
    refreshKey: `${translationResourcesRevision}:${projectDetail?.lastModifiedAt ?? ""}`,
  });
  const {
    segments,
    savedSegmentTargets,
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
    termFuzzyMatchThreshold,
    inlineCaretRestoreSegmentId,
    inlineCaretRestoreToken,
    confirmFocusSegmentId,
    confirmFocusToken,
    setSelectedProviderName,
    handleTargetChange,
    handleActiveSegmentChange,
    handleInlineTranslateSegment,
    handleConfirmSegment,
    handleSplitSegment,
    handleMergeSegments,
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
    onProjectTermsChange: setProjectTerms,
    refreshKey: translationResourcesRevision,
  });
  const hasUnsavedChanges = hasPendingSegmentChanges;
  const navigationBlocker = useBlocker(hasUnsavedChanges);
  const { preview, isLoadingPreview, previewError } = useProjectDocumentPreview({
    projectId,
    documentFileName: projectDetail?.documentFileName,
  });
  const autoTranslateProviderOptions = [
    ...translateProviders.map((provider) => ({
      value: provider.name,
      label: provider.name,
      description: provider.description,
    })),
    ...((projectDetail?.translationMemories.length ?? 0) > 0
      ? [
          {
            value: PROJECT_TRANSLATION_MEMORY_PROVIDER_NAME,
            label: `Translation Memory: ${projectDetail?.translationMemories
              ?.map((translationMemory) => translationMemory.name)
              .join(", ")}`,
            description:
              "Apply the project's linked translation memories to matching segments. Segments without a translation memory match will be left unchanged.",
          },
        ]
      : []),
  ];

  useEffect(() => {
    const nextTabIndex = PROJECT_DETAIL_TAB_VALUE_BY_INDEX.indexOf(
      (currentTabParam ?? "translations") as (typeof PROJECT_DETAIL_TAB_VALUE_BY_INDEX)[number],
    );
    const resolvedTabIndex = nextTabIndex >= 0 ? nextTabIndex : 1;
    handleTabValueChange(resolvedTabIndex);
  }, [currentTabParam, handleTabValueChange]);

  const handleProjectDetailTabChange = (_event: React.SyntheticEvent, value: number) => {
    handleTabValueChange(value);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(
      PROJECT_DETAIL_TAB_PARAM_KEY,
      PROJECT_DETAIL_TAB_VALUE_BY_INDEX[value] ?? PROJECT_DETAIL_TAB_VALUE_BY_INDEX[1],
    );
    setSearchParams(nextSearchParams, { replace: true });
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(PREVIEW_VISIBILITY_STORAGE_KEY, JSON.stringify(isPreviewVisible));
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

  const handleGlossaryItemCreated = async () => {
    if (!projectId) {
      return;
    }

    const nextProjectDetail = await fetchProjectDetail(projectId);
    setProjectDetail(nextProjectDetail);
    handleRefreshTranslationResources();
  };

  if (isLoading || !projectDetail) {
    return <LoadingPageSkeleton />;
  }

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={projectDetail?.name ?? "Project detail"}
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Projects", to: "/projects" }, { label: "Detail" }]}
      />

      <Box className="detail-tabs-shell">
        <Tabs value={activeTab} onChange={handleProjectDetailTabChange} className="detail-tabs" variant="scrollable">
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
          This project is running auto translate in the background. Manual editing is temporarily disabled until the job
          finishes.
        </Alert>
      ) : null}

      <Box className={activeTab === 0 ? "detail-tab-panel" : "detail-tab-panel detail-tab-panel-hidden"}>
        <Box className="detail-home-grid">
          <Box className="detail-home-summary-grid">
            <ProjectDetailInformationSection projectDetail={projectDetail} />
            <Suspense
              fallback={
                <Paper className="detail-section-card" elevation={0}>
                  <LoadingTableSkeleton rows={6} columns={2} showToolbar={false} />
                </Paper>
              }
            >
              <ProjectTranslationSummarySection
                totalSegments={projectDetail.segmentCount}
                translatedSegmentCount={projectDetail.translatedSegmentCount}
                segments={segments}
                projectTerms={projectTerms}
              />
            </Suspense>
          </Box>
          <Box className="detail-home-linked-resources-grid">
            <ProjectDetailTranslationMemoriesSection
              projectDetail={projectDetail}
              translationMemories={draftTranslationMemories}
              availableTranslationMemories={availableTranslationMemories}
              configForm={configForm}
              isConfigDialogOpen={isConfigDialogOpen}
              editingConfigId={editingConfigId}
              draggedTranslationMemoryId={draggedTranslationMemoryId}
              isSaving={isSaving}
              isReadOnly={projectDetail.status === "auto-translate-processing"}
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
            />
            <ProjectDetailGlossariesSection
              projectGlossaries={draftGlossaries}
              availableGlossaries={availableGlossaries}
              glossaryConfigForm={glossaryConfigForm}
              isGlossaryDialogOpen={isGlossaryDialogOpen}
              draggedGlossaryId={draggedGlossaryId}
              isSaving={isSaving}
              isReadOnly={projectDetail.status === "auto-translate-processing"}
              onFieldChange={handleGlossaryConfigFieldChange}
              onOpenAddDialog={handleOpenAddGlossaryDialog}
              onCloseConfigDialog={handleCloseGlossaryDialog}
              onAdd={handleAddGlossary}
              onDelete={handleDeleteGlossaryConfig}
              onDragStart={handleGlossaryDragStart}
              onDragEnd={handleGlossaryDragEnd}
              onDropOnRow={handleDropGlossaryOnRow}
            />
          </Box>
        </Box>
      </Box>

      <Box className={activeTab === 1 ? "detail-tab-panel" : "detail-tab-panel detail-tab-panel-hidden"}>
        <Box className="translations-tab-grid">
          {projectDetail.segmentCount > 0 || hasSegments || isLoadingSegments ? (
            isPreviewVisible ? (
              <TranslationsSplitPane
                alignmentPane={
                  <AlignmentTool
                    segments={segments}
                    savedSegmentTargets={savedSegmentTargets}
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
                    confirmingSegmentId={confirmingSegmentId}
                    inlineTranslateProviderName={inlineTranslateProviderName}
                    termFuzzyMatchThreshold={termFuzzyMatchThreshold}
                    inlineCaretRestoreSegmentId={inlineCaretRestoreSegmentId}
                    inlineCaretRestoreToken={inlineCaretRestoreToken}
                    confirmFocusSegmentId={confirmFocusSegmentId}
                    confirmFocusToken={confirmFocusToken}
                    projectTerms={projectTerms}
                    projectGlossaries={draftGlossaries}
                    isPreviewVisible={isPreviewVisible}
                    restoreScrollKey={segmentSaveRevision}
                    onRegisterFlushPendingChanges={(flushPendingChanges) => {
                      flushPendingTranslationDraftsRef.current = flushPendingChanges;
                    }}
                    onTargetChange={handleTargetChange}
                    onActiveSegmentChange={handleActiveSegmentChange}
                    onInlineTranslateSegment={handleInlineTranslateSegment}
                    onConfirmSegment={handleConfirmSegment}
                    onSplitSegment={(segmentId, splitIndex) => void handleSplitSegment(segmentId, splitIndex)}
                    onJoinSelected={(segmentIds) => void handleMergeSegments(segmentIds)}
                    onSaveAll={() => void handleSaveSegments()}
                    onExport={() => void handleExportDocument()}
                    onOpenAutoTranslate={handleOpenAutoTranslateDialog}
                    onShowPreview={handleShowPreview}
                    onGlossaryItemCreated={handleGlossaryItemCreated}
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
                savedSegmentTargets={savedSegmentTargets}
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
                confirmingSegmentId={confirmingSegmentId}
                inlineTranslateProviderName={inlineTranslateProviderName}
                termFuzzyMatchThreshold={termFuzzyMatchThreshold}
                inlineCaretRestoreSegmentId={inlineCaretRestoreSegmentId}
                inlineCaretRestoreToken={inlineCaretRestoreToken}
                confirmFocusSegmentId={confirmFocusSegmentId}
                confirmFocusToken={confirmFocusToken}
                projectTerms={projectTerms}
                projectGlossaries={draftGlossaries}
                isPreviewVisible={isPreviewVisible}
                restoreScrollKey={segmentSaveRevision}
                onRegisterFlushPendingChanges={(flushPendingChanges) => {
                  flushPendingTranslationDraftsRef.current = flushPendingChanges;
                }}
                onTargetChange={handleTargetChange}
                onActiveSegmentChange={handleActiveSegmentChange}
                onInlineTranslateSegment={handleInlineTranslateSegment}
                onConfirmSegment={handleConfirmSegment}
                onSplitSegment={(segmentId, splitIndex) => void handleSplitSegment(segmentId, splitIndex)}
                onJoinSelected={(segmentIds) => void handleMergeSegments(segmentIds)}
                onSaveAll={() => void handleSaveSegments()}
                onExport={() => void handleExportDocument()}
                onOpenAutoTranslate={handleOpenAutoTranslateDialog}
                onShowPreview={handleShowPreview}
                onGlossaryItemCreated={handleGlossaryItemCreated}
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

      <AutoTranslateDialog
        open={isAutoTranslateDialogOpen}
        isSubmitting={isStartingAutoTranslate}
        providerName={selectedProviderName}
        providers={autoTranslateProviderOptions}
        onProviderChange={setSelectedProviderName}
        onClose={handleCloseAutoTranslateDialog}
        onConfirm={() => void handleConfirmAutoTranslate()}
      />
    </Box>
  );
}

function loadPreviewVisibility() {
  try {
    const storedValue = window.localStorage.getItem(PREVIEW_VISIBILITY_STORAGE_KEY);
    if (storedValue === null) {
      return true;
    }

    const parsedValue = JSON.parse(storedValue);
    return typeof parsedValue === "boolean" ? parsedValue : true;
  } catch {
    return true;
  }
}
