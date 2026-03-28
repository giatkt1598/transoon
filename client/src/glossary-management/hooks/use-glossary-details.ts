import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type {
  GlossaryItem,
  GlossarySummary,
  LanguagesResponse,
} from "../../app/types";
import {
  defaultGlossaryFormValues,
  fetchGlossary,
  fetchGlossaryItems,
  fetchLanguages,
  saveGlossaryItemsChanges,
  saveGlossary,
} from "../api";
import type { GlossaryFormValues, GlossaryItemDraft } from "../types";

type PersistedGlossaryItemPayload = {
  source: string;
  target: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  priority: number;
};

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

const defaultNewGlossaryItem: GlossaryItemDraft = {
  source: "",
  target: "",
  caseSensitive: true,
  wholeWord: true,
  priority: 1,
};

type UseGlossaryDetailsOptions = {
  glossaryId?: string;
};

export function useGlossaryDetails({ glossaryId }: UseGlossaryDetailsOptions) {
  const [languagesData, setLanguagesData] =
    useState<LanguagesResponse>(fallbackLanguages);
  const [glossary, setGlossary] = useState<GlossarySummary | null>(null);
  const [formValues, setFormValues] = useState<GlossaryFormValues>(
    defaultGlossaryFormValues,
  );
  const [savedFormValues, setSavedFormValues] = useState<GlossaryFormValues>(
    defaultGlossaryFormValues,
  );
  const [items, setItems] = useState<GlossaryItem[]>([]);
  const [savedItems, setSavedItems] = useState<GlossaryItem[]>([]);
  const [newItemDraft, setNewItemDraft] = useState<GlossaryItemDraft>(
    defaultNewGlossaryItem,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReady = useMemo(() => Boolean(glossaryId), [glossaryId]);

  useEffect(() => {
    if (!glossaryId) {
      setError("Glossary not found.");
      setIsLoading(false);
      return;
    }

    const resolvedGlossaryId = glossaryId;
    const controller = new AbortController();

    async function loadDetails() {
      try {
        setIsLoading(true);
        setError(null);
        const [languages, existingGlossary, existingItems] = await Promise.all([
          fetchLanguages(controller.signal),
          fetchGlossary(resolvedGlossaryId, controller.signal),
          fetchGlossaryItems(resolvedGlossaryId, controller.signal),
        ]);

        setLanguagesData(languages);
        setGlossary(existingGlossary);
        setFormValues({
          name: existingGlossary.name,
          sourceLanguage: existingGlossary.sourceLanguage,
          targetLanguage: existingGlossary.targetLanguage,
        });
        setSavedFormValues({
          name: existingGlossary.name,
          sourceLanguage: existingGlossary.sourceLanguage,
          targetLanguage: existingGlossary.targetLanguage,
        });
        setItems(existingItems);
        setSavedItems(existingItems);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load glossary details.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDetails();
    return () => controller.abort();
  }, [glossaryId]);

  function handleFieldChange<K extends keyof GlossaryFormValues>(
    field: K,
    value: GlossaryFormValues[K],
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const hasPendingChanges = useMemo(() => {
    return (
      JSON.stringify(formValues) !== JSON.stringify(savedFormValues) ||
      JSON.stringify(serializeGlossaryItems(items)) !==
        JSON.stringify(serializeGlossaryItems(savedItems))
    );
  }, [formValues, items, savedFormValues, savedItems]);

  async function handleSaveGlossary() {
    if (!glossaryId) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const savedGlossary = await saveGlossary(glossaryId, formValues);
      const savedCurrentItems = await persistGlossaryItems(
        glossaryId,
        savedItems,
        items,
      );
      setGlossary(savedGlossary);
      setSavedFormValues({
        name: savedGlossary.name,
        sourceLanguage: savedGlossary.sourceLanguage,
        targetLanguage: savedGlossary.targetLanguage,
      });
      setItems(savedCurrentItems);
      setSavedItems(savedCurrentItems);
      toast.success("Glossary updated successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save glossary.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleGlossaryItemDraftChange(
    glossaryItemId: string,
    field: keyof GlossaryItemDraft,
    value: string | number | boolean,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === glossaryItemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  async function handleGlossaryItemBlur(glossaryItemId: string) {
    const glossaryItem = items.find((item) => item.id === glossaryItemId);
    if (!glossaryItem) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === glossaryItemId
          ? {
              ...item,
              source: item.source.trim(),
              target: item.target.trim(),
            }
          : item,
      ),
    );
  }

  function handleNewItemDraftChange<K extends keyof GlossaryItemDraft>(
    field: K,
    value: GlossaryItemDraft[K],
  ) {
    setNewItemDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCreateGlossaryItem() {
    try {
      const currentCaseSensitive = newItemDraft.caseSensitive;
      const source = newItemDraft.source.trim();
      const target = newItemDraft.target.trim();
      if (!source || !target) {
        toast.error("Glossary items require both source and target text.");
        return false;
      }

      const now = new Date().toISOString();
      const createdItem: GlossaryItem = {
        id: `draft:${crypto.randomUUID()}`,
        glossaryId: glossaryId ?? "",
        source,
        sourceNormalized: normalizeGlossarySourceValue(source),
        target,
        targetNormalized: normalizeGlossaryText(target),
        caseSensitive: newItemDraft.caseSensitive,
        wholeWord: true,
        priority: 1,
        lastModifiedAt: now,
        lastUsedAt: null,
        createdAt: now,
      };

      setItems((currentItems) => [createdItem, ...currentItems]);
      setNewItemDraft({
        ...defaultNewGlossaryItem,
        caseSensitive: currentCaseSensitive,
      });
      return true;
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Could not stage glossary item.",
      );
      return false;
    }
  }

  async function handleDeleteGlossaryItem(glossaryItemId: string) {
    try {
      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== glossaryItemId),
      );
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove glossary item.",
      );
    }
  }

  function handleImportGlossaryItems(importedItems: GlossaryItemDraft[]) {
    const now = new Date().toISOString();
    const nextImportedItems = importedItems
      .map((item): GlossaryItem | null => {
        const source = item.source.trim();
        const target = item.target.trim();
        if (!source || !target) {
          return null;
        }

        return {
          id: `draft:${crypto.randomUUID()}`,
          glossaryId: glossaryId ?? "",
          source,
          sourceNormalized: normalizeGlossarySourceValue(source),
          target,
          targetNormalized: normalizeGlossaryText(target),
          caseSensitive: item.caseSensitive,
          wholeWord: true,
          priority: 1,
          lastModifiedAt: now,
          lastUsedAt: null,
          createdAt: now,
        };
      })
      .filter((item): item is GlossaryItem => item !== null);

    if (nextImportedItems.length === 0) {
      return;
    }

    setItems((currentItems) => {
      const nextItems = [...currentItems];

      nextImportedItems.forEach((importedItem) => {
        const existingItemIndex = nextItems.findIndex((existingItem) =>
          isDuplicateGlossarySource(existingItem, importedItem),
        );

        if (existingItemIndex < 0) {
          nextItems.push(importedItem);
          return;
        }

        const existingItem = nextItems[existingItemIndex];
        if (!existingItem) {
          return;
        }

        nextItems[existingItemIndex] = {
          ...existingItem,
          source: importedItem.source,
          sourceNormalized: importedItem.sourceNormalized,
          target: importedItem.target,
          targetNormalized: importedItem.targetNormalized,
          caseSensitive: importedItem.caseSensitive,
          wholeWord: true,
          priority: 1,
          lastModifiedAt: now,
        };
      });

      return nextItems;
    });
  }

  return {
    languagesData,
    glossary,
    formValues,
    items,
    newItemDraft,
    isReady,
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
    handleImportGlossaryItems,
  };
}

async function persistGlossaryItems(
  glossaryId: string,
  originalItems: GlossaryItem[],
  draftItems: GlossaryItem[],
) {
  const originalIds = new Set(originalItems.map((item) => item.id));
  const draftIds = new Set(draftItems.map((item) => item.id));

  const deletedItemIds = originalItems
    .filter((item) => !draftIds.has(item.id))
    .map((item) => item.id);

  const createdItems = draftItems
    .filter((item) => item.id.startsWith("draft:") || !originalIds.has(item.id))
    .map(toPersistedGlossaryItemDraft)
    .filter(
      (item): item is {
        source: string;
        target: string;
        caseSensitive: boolean;
        wholeWord: boolean;
        priority: number;
      } => item !== null,
    );

  const originalItemsById = new Map(originalItems.map((item) => [item.id, item] as const));
  const updatedItems = draftItems
    .filter((item) => !item.id.startsWith("draft:") && originalIds.has(item.id))
    .map((item) => {
      const originalItem = originalItemsById.get(item.id);
      if (!originalItem || !hasGlossaryItemChanged(originalItem, item)) {
        return null;
      }

      const persistedDraft = toPersistedGlossaryItemDraft(item);
      if (!persistedDraft) {
        return null;
      }

      return {
        id: item.id,
        ...persistedDraft,
      };
    })
    .filter(
      (item): item is {
        id: string;
        source: string;
        target: string;
        caseSensitive: boolean;
        wholeWord: boolean;
        priority: number;
      } => item !== null,
    );

  if (
    createdItems.length === 0 &&
    updatedItems.length === 0 &&
    deletedItemIds.length === 0
  ) {
    return draftItems
      .map((item) => ({
        ...item,
        source: item.source.trim(),
        target: item.target.trim(),
      }))
      .filter((item) => item.source.length > 0 && item.target.length > 0);
  }

  return saveGlossaryItemsChanges(glossaryId, {
    createdItems,
    updatedItems,
    deletedItemIds,
  });
}

function serializeGlossaryItems(items: GlossaryItem[]) {
  return items.map((item) => ({
    id: item.id,
    source: item.source.trim(),
    target: item.target.trim(),
    caseSensitive: item.caseSensitive,
    wholeWord: item.wholeWord,
    priority: 1,
  }));
}

function normalizeGlossaryText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function toPersistedGlossaryItemDraft(
  item: Pick<GlossaryItem, "source" | "target" | "caseSensitive">,
): PersistedGlossaryItemPayload | null {
  const source = item.source.trim();
  const target = item.target.trim();

  if (!source || !target) {
    return null;
  }

  return {
    source,
    target,
    caseSensitive: item.caseSensitive,
    wholeWord: true,
    priority: 1,
  };
}

function hasGlossaryItemChanged(originalItem: GlossaryItem, draftItem: GlossaryItem) {
  return (
    originalItem.source.trim() !== draftItem.source.trim() ||
    originalItem.target.trim() !== draftItem.target.trim() ||
    originalItem.caseSensitive !== draftItem.caseSensitive
  );
}

function normalizeGlossarySourceValue(value: string) {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => normalizeGlossaryText(part))
    .join(";");
}

function isDuplicateGlossarySource(left: GlossaryItem, right: GlossaryItem) {
  const leftSources = splitGlossarySourceValues(left.source);
  const rightSources = splitGlossarySourceValues(right.source);
  if (leftSources.length === 0 || rightSources.length === 0) {
    return false;
  }

  return leftSources.some((leftSource) =>
    rightSources.some((rightSource) => {
      if (leftSource === rightSource) {
        return true;
      }

      return (
        leftSource.toLocaleLowerCase() === rightSource.toLocaleLowerCase() &&
        (!left.caseSensitive || !right.caseSensitive)
      );
    }),
  );
}

function splitGlossarySourceValues(value: string) {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
