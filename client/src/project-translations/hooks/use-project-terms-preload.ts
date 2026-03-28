import { useEffect, useState } from "react";
import { fetchProjectTerms } from "../../project-management/api";
import type { ProjectTerm } from "../../app/types";
import {
  loadCachedProjectTerms,
  saveProjectTermsToCache,
} from "../project-term-cache";

type UseProjectTermsPreloadOptions = {
  projectId?: string;
  refreshKey?: number | string;
};

export function useProjectTermsPreload({
  projectId,
  refreshKey = 0,
}: UseProjectTermsPreloadOptions) {
  const [projectTerms, setProjectTerms] = useState<ProjectTerm[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function preloadProjectTerms() {
      if (!projectId) {
        if (isMounted) {
          setProjectTerms([]);
        }
        return;
      }

      try {
        const cachedRecord = await loadCachedProjectTerms(projectId);
        if (cachedRecord && isMounted) {
          setProjectTerms(cachedRecord.terms);
        }

        const terms = await fetchProjectTerms(projectId, controller.signal);
        if (!isMounted) {
          return;
        }

        setProjectTerms(terms);
        await saveProjectTermsToCache(projectId, terms);
      } catch {
        // Keep this silent. Term preload is a background optimization.
      }
    }

    void preloadProjectTerms();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [projectId, refreshKey]);

  return {
    projectTerms,
    setProjectTerms,
  };
}
