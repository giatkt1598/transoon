import { Box, Button, MenuItem, TextField, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useBlocker, useParams } from "react-router-dom";
import type { SortDirection } from "../app/linq";
import type { TranslationMemoryTerm } from "../app/types";
import { LoadingPageSkeleton } from "../components/loading-skeleton";
import { LanguageSwapButton } from "../components/language-swap-button";
import { ProjectPageHeader } from "../project-management/components/project-page-header";
import { TranslationMemoryTermsTable } from "../translation-memory-management/components/translation-memory-terms-table";
import { useTranslationMemoryDetails } from "../translation-memory-management/hooks/use-translation-memory-details";

function formatDateTime(value: string | null) {
  if (!value) {
    return {
      date: "Never used",
      time: "No activity yet",
    };
  }

  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes in this translation memory. Do you want to leave this page? Your changes will not be saved.";

export function TranslationMemoryDetailPage() {
  const [activeTab, setActiveTab] = useState(1);
  const [termsSearchInput, setTermsSearchInput] = useState("");
  const [termsSearchTerm, setTermsSearchTerm] = useState("");
  const DEFAULT_SORT_COLUMN: keyof TranslationMemoryTerm = "createdAt";
  const DEFAULT_SORT_DIRECTION: SortDirection = "desc";
  const [termsSortState, setTermsSortState] = useState<{
    column: keyof TranslationMemoryTerm;
    direction: SortDirection;
  } | null>({
    column: DEFAULT_SORT_COLUMN,
    direction: DEFAULT_SORT_DIRECTION,
  });
  const [termsPage, setTermsPage] = useState(0);
  const [termsRowsPerPage, setTermsRowsPerPage] = useState(10);
  const { translationMemoryId } = useParams();
  const {
    languagesData,
    translationMemory,
    formValues,
    terms,
    newTermDraft,
    isLoading,
    isSaving,
    hasPendingChanges,
    error,
    handleFieldChange,
    handleSaveTranslationMemory,
    handleTermDraftChange,
    handleTermBlur,
    handleNewTermDraftChange,
    handleCreateTerm,
    handleDeleteTerm,
    handleImportTerms,
  } = useTranslationMemoryDetails({ translationMemoryId });
  const sourceInputRef = useRef<any>(null);
  const targetInputRef = useRef<any>(null);
  const searchThrottleTimeoutRef = useRef<number | null>(null);
  const lastSearchApplyAtRef = useRef(0);
  const pendingSearchValueRef = useRef(termsSearchInput);
  const navigationBlocker = useBlocker(hasPendingChanges);
  const lastModified = formatDateTime(translationMemory?.lastModifiedAt ?? null);
  const lastUsed = formatDateTime(translationMemory?.lastUsedAt ?? null);
  const sourceLanguageLabel =
    languagesData.languages.find(
      (language) => language.code === formValues.sourceLanguage,
    )?.label ?? formValues.sourceLanguage;
  const targetLanguageLabel =
    languagesData.languages.find(
      (language) => language.code === formValues.targetLanguage,
    )?.label ?? formValues.targetLanguage;

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
      if (!hasPendingChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingChanges]);

  useEffect(() => {
    pendingSearchValueRef.current = termsSearchInput;

    const applySearchTerm = () => {
      const nextSearchTerm = pendingSearchValueRef.current;
      searchThrottleTimeoutRef.current = null;
      lastSearchApplyAtRef.current = Date.now();

      setTermsSearchTerm((currentValue) => {
        if (currentValue === nextSearchTerm) {
          return currentValue;
        }

        setTermsPage(0);
        return nextSearchTerm;
      });
    };

    const elapsedTime = Date.now() - lastSearchApplyAtRef.current;
    const remainingTime = Math.max(0, 300 - elapsedTime);

    if (remainingTime === 0) {
      if (searchThrottleTimeoutRef.current !== null) {
        window.clearTimeout(searchThrottleTimeoutRef.current);
        searchThrottleTimeoutRef.current = null;
      }

      applySearchTerm();
      return;
    }

    if (searchThrottleTimeoutRef.current === null) {
      searchThrottleTimeoutRef.current = window.setTimeout(
        applySearchTerm,
        remainingTime,
      );
    }
  }, [termsSearchInput]);

  useEffect(() => {
    return () => {
      if (searchThrottleTimeoutRef.current !== null) {
        window.clearTimeout(searchThrottleTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title={translationMemory?.name ?? "Translation memory details"}
        breadcrumbs={[
          { label: "Dashboard", to: "/" },
          { label: "Translation Memories", to: "/translation-memories" },
          { label: translationMemory?.name ?? "Details" },
        ]}
        actionLabel="Save"
        onActionClick={() => void handleSaveTranslationMemory()}
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
          <Tab label="Terms" />
        </Tabs>
      </Box>

      {isLoading ? (
        <LoadingPageSkeleton />
      ) : (
        <>
          <Box
            className={
              activeTab === 0
                ? "detail-tab-panel"
                : "detail-tab-panel detail-tab-panel-hidden"
            }
          >
            <Box className="detail-home-grid detail-home-grid-narrow">
              <Box className="detail-section-card">
                <Box className="project-editor-section-head">
                  <Box>
                    <Typography component="h2" className="project-editor-title">
                      Details
                    </Typography>
                    <Typography component="p" className="project-editor-copy">
                      Update metadata and language routing for{" "}
                      {translationMemory?.name ?? "this translation memory"}.
                    </Typography>
                  </Box>
                </Box>

                <Box className="project-editor-form">
                  <Box className="detail-description-block">
                    <Typography component="span">Translation memory name</Typography>
                    <TextField
                      fullWidth
                      value={formValues.name}
                      onChange={(event) => handleFieldChange("name", event.target.value)}
                      placeholder="Consumer electronics EN -> JA"
                      disabled={isSaving}
                      sx={{ mt: 1.5 }}
                    />
                  </Box>

                  <Box className="detail-info-grid">
                    <Box className="detail-info-item detail-language-pair-item">
                      <Box className="detail-language-pair-grid">
                        <TextField
                          select
                          fullWidth
                          label="Source language"
                          value={formValues.sourceLanguage}
                          onChange={(event) =>
                            handleFieldChange("sourceLanguage", event.target.value)
                          }
                          disabled={isSaving}
                        >
                          {languagesData.languages
                            .filter(
                              (language) =>
                                language.code !== formValues.targetLanguage,
                            )
                            .map((language) => (
                              <MenuItem key={language.code} value={language.code}>
                                {language.label}
                              </MenuItem>
                            ))}
                        </TextField>
                        <LanguageSwapButton
                          disabled={formValues.sourceLanguage === "auto"}
                          disabledReason="Auto detect cannot be used as the target language."
                          onClick={() => {
                            handleFieldChange(
                              "sourceLanguage",
                              formValues.targetLanguage,
                            );
                            handleFieldChange(
                              "targetLanguage",
                              formValues.sourceLanguage,
                            );
                          }}
                        />
                        <TextField
                          select
                          fullWidth
                          label="Target language"
                          value={formValues.targetLanguage}
                          onChange={(event) =>
                            handleFieldChange("targetLanguage", event.target.value)
                          }
                          disabled={isSaving}
                        >
                          {languagesData.languages
                            .filter(
                              (language) =>
                                language.code !== "auto" &&
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
                ? "detail-tab-panel"
                : "detail-tab-panel detail-tab-panel-hidden"
            }
          >
            <Box className="detail-home-grid">
              <Box className="detail-section-card">
                <Box className="project-editor-section-head">
                  <Box>
                    <Typography component="h2" className="project-editor-title">
                      Terms
                    </Typography>
                    <Typography component="p" className="project-editor-copy">
                      Search, edit, import, and export terms in this translation memory.
                    </Typography>
                  </Box>
                </Box>

                <Box className="project-editor-form" sx={{ gap: 3 }}>
                  <Box
                    className="project-editor-grid"
                    sx={{ gridTemplateColumns: "auto 1.2fr 1.2fr auto" }}
                  >
                    <Typography
                      component="span"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        fontWeight: 600,
                        color: "#6f5b4c",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Add New:
                    </Typography>
                    <TextField
                      inputRef={sourceInputRef}
                      label={`Source (${sourceLanguageLabel})`}
                      value={newTermDraft.sourceTerm}
                      onChange={(event) =>
                        handleNewTermDraftChange("sourceTerm", event.target.value)
                      }
                      onKeyUp={(event) => {
                        if (event.key === "Enter" && newTermDraft.sourceTerm.trim()) {
                          targetInputRef.current?.focus();
                        }
                      }}
                    />
                    <TextField
                      inputRef={targetInputRef}
                      label={`Target (${targetLanguageLabel})`}
                      value={newTermDraft.targetTerm}
                      onChange={(event) =>
                        handleNewTermDraftChange("targetTerm", event.target.value)
                      }
                      onKeyUp={(event) => {
                        if (event.key === "Enter" && newTermDraft.targetTerm.trim()) {
                          void (async () => {
                        const didCreateTerm = await handleCreateTerm();
                        if (!didCreateTerm) {
                          return;
                        }

                        setTermsSearchInput("");
                        setTermsSearchTerm("");
                        setTermsSortState({
                          column: DEFAULT_SORT_COLUMN,
                          direction: DEFAULT_SORT_DIRECTION,
                        });
                        setTermsPage(0);
                        sourceInputRef.current?.focus();
                      })();
                    }
                  }}
                    />
                    <Button
                      variant="contained"
                      className="submit-button"
                      onClick={async () => {
                        const didCreateTerm = await handleCreateTerm();
                        if (!didCreateTerm) {
                          return;
                        }

                        setTermsSearchInput("");
                        setTermsSearchTerm("");
                        setTermsSortState({
                          column: DEFAULT_SORT_COLUMN,
                          direction: DEFAULT_SORT_DIRECTION,
                        });
                        setTermsPage(0);
                        sourceInputRef.current?.focus();
                      }}
                    >
                      Add term
                    </Button>
                  </Box>

                  <TranslationMemoryTermsTable
                    translationMemoryName={translationMemory?.name ?? "Translation memory terms"}
                    terms={terms}
                    isLoading={isLoading}
                    sourceLanguageCode={formValues.sourceLanguage}
                    targetLanguageCode={formValues.targetLanguage}
                    sourceLanguageLabel={sourceLanguageLabel}
                    targetLanguageLabel={targetLanguageLabel}
                    searchInputValue={termsSearchInput}
                    searchTerm={termsSearchTerm}
                    onSearchChange={setTermsSearchInput}
                    sortState={termsSortState}
                    onSortChange={setTermsSortState}
                    page={termsPage}
                    rowsPerPage={termsRowsPerPage}
                    onPageChange={setTermsPage}
                    onRowsPerPageChange={setTermsRowsPerPage}
                    onTermDraftChange={handleTermDraftChange}
                    onTermBlur={handleTermBlur}
                    onDeleteTerm={handleDeleteTerm}
                    onImportTerms={handleImportTerms}
                  />
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
    </Box>
  );
}
