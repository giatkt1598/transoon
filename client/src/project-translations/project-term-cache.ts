import type { ProjectTerm } from "../app/types";

const DATABASE_NAME = "transoon-project-term-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "projectTerms";

type ProjectTermCacheRecord = {
  projectId: string;
  updatedAt: string;
  terms: ProjectTerm[];
};

function openProjectTermCacheDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "projectId",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open project term cache."));
  });
}

export async function loadCachedProjectTerms(projectId: string) {
  const database = await openProjectTermCacheDatabase();

  return new Promise<ProjectTermCacheRecord | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(projectId);

    request.onsuccess = () => {
      resolve((request.result as ProjectTermCacheRecord | undefined) ?? null);
      database.close();
    };
    request.onerror = () => {
      reject(
        request.error ?? new Error("Could not read project term cache."),
      );
      database.close();
    };
  });
}

export async function saveProjectTermsToCache(
  projectId: string,
  terms: ProjectTerm[],
) {
  const database = await openProjectTermCacheDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put({
      projectId,
      updatedAt: new Date().toISOString(),
      terms,
    } satisfies ProjectTermCacheRecord);

    transaction.oncomplete = () => {
      resolve();
      database.close();
    };
    transaction.onerror = () => {
      reject(
        transaction.error ?? new Error("Could not write project term cache."),
      );
      database.close();
    };
  });
}

export async function upsertProjectTermInCache(
  projectId: string,
  term: ProjectTerm,
) {
  const cachedRecord = await loadCachedProjectTerms(projectId);
  const nextTerms = [...(cachedRecord?.terms ?? [])];
  const existingIndex = nextTerms.findIndex(
    (item) =>
      item.translationMemoryId === term.translationMemoryId &&
      item.sourceTermNormalized === term.sourceTermNormalized,
  );

  if (existingIndex >= 0) {
    nextTerms[existingIndex] = term;
  } else {
    nextTerms.push(term);
  }

  nextTerms.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    if (left.accessMode !== right.accessMode) {
      return left.accessMode === "write" ? -1 : 1;
    }

    return right.lastModifiedAt.localeCompare(left.lastModifiedAt);
  });

  await saveProjectTermsToCache(projectId, nextTerms);
}
