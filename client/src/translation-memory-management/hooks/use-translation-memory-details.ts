import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type {
  LanguagesResponse,
  TranslationMemorySummary,
  TranslationMemoryTerm,
} from "../../app/types";
import {
  defaultTranslationMemoryFormValues,
  fetchLanguages,
  fetchTranslationMemory,
  fetchTranslationMemoryTerms,
  saveTranslationMemory,
  saveTranslationMemoryTermsChanges,
} from "../api";
import type { TranslationMemoryFormValues } from "../types";
import type { TranslationMemoryTermDraft } from "../translation-memory-term-transfer";

const fallbackLanguages: LanguagesResponse = {
  defaultSourceLanguage: "en",
  defaultTargetLanguage: "ja",
  languages: [
    { code: "auto", label: "Auto detect" },
    { code: "en", label: "English" },
    { code: "ja", label: "Japanese" },
    { code: "vi", label: "Vietnamese" },
    { code: "zh-CN", label: "Chinese (Simplified)" },
    { code: "ko", label: "Korean" },
    { code: "fr", label: "French" },
    { code: "de", label: "German" },
    { code: "es", label: "Spanish" },
  ],
};

const defaultNewTermDraft: TranslationMemoryTermDraft = {
  sourceTerm: "",
  targetTerm: "",
};

type UseTranslationMemoryDetailsOptions = {
  translationMemoryId?: string;
};

export function useTranslationMemoryDetails({
  translationMemoryId,
}: UseTranslationMemoryDetailsOptions) {
  const [languagesData, setLanguagesData] =
    useState<LanguagesResponse>(fallbackLanguages);
  const [translationMemory, setTranslationMemory] =
    useState<TranslationMemorySummary | null>(null);
  const [formValues, setFormValues] = useState<TranslationMemoryFormValues>(
    defaultTranslationMemoryFormValues,
  );
  const [savedFormValues, setSavedFormValues] =
    useState<TranslationMemoryFormValues>(defaultTranslationMemoryFormValues);
  const [terms, setTerms] = useState<TranslationMemoryTerm[]>([]);
  const [savedTerms, setSavedTerms] = useState<TranslationMemoryTerm[]>([]);
  const [newTermDraft, setNewTermDraft] =
    useState<TranslationMemoryTermDraft>(defaultNewTermDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReady = useMemo(() => Boolean(translationMemoryId), [translationMemoryId]);

  useEffect(() => {
    if (!translationMemoryId) {
      setError("Translation memory not found.");
      setIsLoading(false);
      return;
    }

    const resolvedTranslationMemoryId = translationMemoryId;
    const controller = new AbortController();

    async function loadDetails() {
      try {
        setIsLoading(true);
        setError(null);
        const [languages, existingTranslationMemory, existingTerms] = await Promise.all([
          fetchLanguages(controller.signal),
          fetchTranslationMemory(resolvedTranslationMemoryId, controller.signal),
          fetchTranslationMemoryTerms(resolvedTranslationMemoryId, controller.signal),
        ]);

        setLanguagesData(languages);
        setTranslationMemory(existingTranslationMemory);
        const nextFormValues = {
          name: existingTranslationMemory.name,
          sourceLanguage: existingTranslationMemory.sourceLanguage,
          targetLanguage: existingTranslationMemory.targetLanguage,
        };
        setFormValues(nextFormValues);
        setSavedFormValues(nextFormValues);
        setTerms(existingTerms);
        setSavedTerms(existingTerms);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load translation memory details.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDetails();
    return () => controller.abort();
  }, [translationMemoryId]);

  const hasPendingChanges = useMemo(() => {
    return (
      JSON.stringify(formValues) !== JSON.stringify(savedFormValues) ||
      JSON.stringify(serializeTranslationMemoryTerms(terms)) !==
        JSON.stringify(serializeTranslationMemoryTerms(savedTerms))
    );
  }, [formValues, savedFormValues, terms, savedTerms]);

  function handleFieldChange<K extends keyof TranslationMemoryFormValues>(
    field: K,
    value: TranslationMemoryFormValues[K],
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  async function handleSaveTranslationMemory() {
    if (!translationMemoryId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const savedTranslationMemory = await saveTranslationMemory(
        translationMemoryId,
        formValues,
      );
      const savedCurrentTerms = await persistTranslationMemoryTerms(
        translationMemoryId,
        savedTerms,
        terms,
      );

      setTranslationMemory(savedTranslationMemory);
      const nextFormValues = {
        name: savedTranslationMemory.name,
        sourceLanguage: savedTranslationMemory.sourceLanguage,
        targetLanguage: savedTranslationMemory.targetLanguage,
      };
      setFormValues(nextFormValues);
      setSavedFormValues(nextFormValues);
      setTerms(savedCurrentTerms);
      setSavedTerms(savedCurrentTerms);
      toast.success("Translation memory updated successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save translation memory.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleTermDraftChange(
    termId: string,
    field: "sourceTerm" | "targetTerm",
    value: string,
  ) {
    setTerms((currentTerms) =>
      currentTerms.map((term) =>
        term.id === termId
          ? {
              ...term,
              [field]: value,
            }
          : term,
      ),
    );
  }

  async function handleTermBlur(termId: string) {
    const term = terms.find((item) => item.id === termId);
    if (!term) {
      return;
    }

    setTerms((currentTerms) =>
      currentTerms.map((item) =>
        item.id === termId
          ? {
              ...item,
              sourceTerm: item.sourceTerm.trim(),
              targetTerm: item.targetTerm.trim(),
            }
          : item,
      ),
    );
  }

  function handleNewTermDraftChange<K extends keyof TranslationMemoryTermDraft>(
    field: K,
    value: TranslationMemoryTermDraft[K],
  ) {
    setNewTermDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  async function handleCreateTerm() {
    const sourceTerm = newTermDraft.sourceTerm.trim();
    const targetTerm = newTermDraft.targetTerm.trim();
    if (!sourceTerm || !targetTerm) {
      toast.error("Translation memory terms require both source and target text.");
      return false;
    }

    const now = new Date().toISOString();
    const createdTerm: TranslationMemoryTerm = {
      id: `draft:${crypto.randomUUID()}`,
      translationMemoryId: translationMemoryId ?? "",
      sourceTerm,
      sourceTermNormalized: normalizeTerm(sourceTerm),
      targetTerm,
      targetTermNormalized: normalizeTerm(targetTerm),
      lastModifiedAt: now,
      lastUsedAt: null,
      createdAt: now,
    };

    setTerms((currentTerms) => [...currentTerms, createdTerm]);
    setNewTermDraft(defaultNewTermDraft);
    return true;
  }

  async function handleDeleteTerm(termId: string) {
    setTerms((currentTerms) => currentTerms.filter((term) => term.id !== termId));
  }

  function handleImportTerms(importedItems: TranslationMemoryTermDraft[]) {
    const now = new Date().toISOString();
    const nextImportedTerms = importedItems
      .map((item): TranslationMemoryTerm | null => {
        const sourceTerm = item.sourceTerm.trim();
        const targetTerm = item.targetTerm.trim();
        if (!sourceTerm || !targetTerm) {
          return null;
        }

        return {
          id: `draft:${crypto.randomUUID()}`,
          translationMemoryId: translationMemoryId ?? "",
          sourceTerm,
          sourceTermNormalized: normalizeTerm(sourceTerm),
          targetTerm,
          targetTermNormalized: normalizeTerm(targetTerm),
          lastModifiedAt: now,
          lastUsedAt: null,
          createdAt: now,
        };
      })
      .filter((item): item is TranslationMemoryTerm => item !== null);

    if (nextImportedTerms.length === 0) {
      return;
    }

    setTerms((currentTerms) => {
      const nextTerms = [...currentTerms];

      nextImportedTerms.forEach((importedTerm) => {
        const existingTermIndex = nextTerms.findIndex(
          (existingTerm) =>
            existingTerm.sourceTermNormalized === importedTerm.sourceTermNormalized,
        );

        if (existingTermIndex < 0) {
          nextTerms.push(importedTerm);
          return;
        }

        const existingTerm = nextTerms[existingTermIndex];
        if (!existingTerm) {
          return;
        }

        nextTerms[existingTermIndex] = {
          ...existingTerm,
          sourceTerm: importedTerm.sourceTerm,
          sourceTermNormalized: importedTerm.sourceTermNormalized,
          targetTerm: importedTerm.targetTerm,
          targetTermNormalized: importedTerm.targetTermNormalized,
          lastModifiedAt: now,
        };
      });

      return nextTerms;
    });
  }

  return {
    languagesData,
    translationMemory,
    formValues,
    terms,
    newTermDraft,
    isReady,
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
  };
}

async function persistTranslationMemoryTerms(
  translationMemoryId: string,
  originalTerms: TranslationMemoryTerm[],
  draftTerms: TranslationMemoryTerm[],
) {
  const originalIds = new Set(originalTerms.map((term) => term.id));
  const draftIds = new Set(draftTerms.map((term) => term.id));

  const deletedItemIds = originalTerms
    .filter((term) => !draftIds.has(term.id))
    .map((term) => term.id);

  const createdItems = draftTerms
    .filter((term) => term.id.startsWith("draft:") || !originalIds.has(term.id))
    .map(toPersistedTranslationMemoryTermDraft)
    .filter(
      (
        term,
      ): term is {
        sourceTerm: string;
        targetTerm: string;
      } => term !== null,
    );

  const originalTermsById = new Map(originalTerms.map((term) => [term.id, term] as const));
  const updatedItems = draftTerms
    .filter((term) => !term.id.startsWith("draft:") && originalIds.has(term.id))
    .map((term) => {
      const originalTerm = originalTermsById.get(term.id);
      if (!originalTerm || !hasTranslationMemoryTermChanged(originalTerm, term)) {
        return null;
      }

      const persistedDraft = toPersistedTranslationMemoryTermDraft(term);
      if (!persistedDraft) {
        return null;
      }

      return {
        id: term.id,
        ...persistedDraft,
      };
    })
    .filter(
      (
        term,
      ): term is {
        id: string;
        sourceTerm: string;
        targetTerm: string;
      } => term !== null,
    );

  if (
    createdItems.length === 0 &&
    updatedItems.length === 0 &&
    deletedItemIds.length === 0
  ) {
    return draftTerms
      .map((term) => ({
        ...term,
        sourceTerm: term.sourceTerm.trim(),
        targetTerm: term.targetTerm.trim(),
      }))
      .filter((term) => term.sourceTerm.length > 0 && term.targetTerm.length > 0);
  }

  return saveTranslationMemoryTermsChanges(translationMemoryId, {
    createdItems,
    updatedItems,
    deletedItemIds,
  });
}

function serializeTranslationMemoryTerms(terms: TranslationMemoryTerm[]) {
  return terms.map((term) => ({
    id: term.id,
    sourceTerm: term.sourceTerm.trim(),
    targetTerm: term.targetTerm.trim(),
  }));
}

function normalizeTerm(value: string) {
  return value.trim().toLowerCase();
}

function toPersistedTranslationMemoryTermDraft(
  term: Pick<TranslationMemoryTerm, "sourceTerm" | "targetTerm">,
) {
  const sourceTerm = term.sourceTerm.trim();
  const targetTerm = term.targetTerm.trim();

  if (!sourceTerm || !targetTerm) {
    return null;
  }

  return {
    sourceTerm,
    targetTerm,
  };
}

function hasTranslationMemoryTermChanged(
  originalTerm: TranslationMemoryTerm,
  draftTerm: TranslationMemoryTerm,
) {
  return (
    originalTerm.sourceTerm.trim() !== draftTerm.sourceTerm.trim() ||
    originalTerm.targetTerm.trim() !== draftTerm.targetTerm.trim()
  );
}
