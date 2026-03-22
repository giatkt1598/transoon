import { apiBaseUrl } from '../app/config'
import type {
  ConfirmedProjectSegmentResponse,
  LanguagesResponse,
  InlineTranslatedProjectSegmentResponse,
  MergedProjectSegmentsResponse,
  ProjectDetail,
  ProjectDocumentPreview,
  ProjectSegment,
  ProjectSegmentsResponse,
  SplitProjectSegmentResponse,
  ProjectSummary,
  ProjectTerm,
  ProjectTermsResponse,
  ProjectsResponse,
  ProjectTranslationMemoryConfig,
  TranslateProvidersResponse,
  TranslationMemoriesResponse,
} from '../app/types'
import type { ProjectFormValues } from './types'

const fallbackLanguages: LanguagesResponse = {
  defaultSourceLanguage: 'en',
  defaultTargetLanguage: 'ja',
  languages: [
    { code: 'auto', label: 'Auto detect' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: 'Japanese' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'zh-CN', label: 'Chinese (Simplified)' },
    { code: 'ko', label: 'Korean' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'es', label: 'Spanish' },
  ],
}

export const defaultProjectFormValues: ProjectFormValues = {
  name: '',
  description: '',
  sourceLang: fallbackLanguages.defaultSourceLanguage,
  targetLang: fallbackLanguages.defaultTargetLanguage,
}

export function getFallbackLanguages() {
  return fallbackLanguages
}

async function readJsonResponse<T>(response: Response) {
  const responseText = await response.text()

  try {
    return JSON.parse(responseText) as T
  } catch {
    throw new Error(
      responseText.startsWith('<')
        ? 'The server returned HTML instead of JSON. Check that the API server is running and the route completed successfully.'
        : 'The server returned an invalid JSON response.',
    )
  }
}

export async function fetchLanguages(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/languages`, { signal })
  if (!response.ok) {
    throw new Error('Could not load language options.')
  }

  return readJsonResponse<LanguagesResponse>(response)
}

export async function fetchProjects(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects`, { signal })
  const data = await readJsonResponse<ProjectsResponse | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load projects.' : 'Could not load projects.')
  }

  return (data as ProjectsResponse).projects
}

export async function fetchProject(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}`, { signal })
  const data = await readJsonResponse<ProjectSummary | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load project.' : 'Could not load project.')
  }

  return data as ProjectSummary
}

export async function fetchProjectDetail(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/detail`, { signal })
  const data = await readJsonResponse<ProjectDetail | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load project detail.' : 'Could not load project detail.')
  }

  return data as ProjectDetail
}

export async function fetchProjectSegments(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/segments`, { signal })
  const data = await readJsonResponse<ProjectSegmentsResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load project segments.' : 'Could not load project segments.')
  }

  return (data as ProjectSegmentsResponse).segments
}

export async function fetchProjectTerms(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/terms`, { signal })
  const data = await readJsonResponse<ProjectTermsResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load project terms.' : 'Could not load project terms.')
  }

  return (data as ProjectTermsResponse).terms as ProjectTerm[]
}

export async function fetchProjectDocumentPreview(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/document-preview`, { signal })
  const data = await readJsonResponse<ProjectDocumentPreview | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not load project document preview.' : 'Could not load project document preview.',
    )
  }

  return data as ProjectDocumentPreview
}

export async function generateProjectSegments(projectId: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/generate-segments`, {
    method: 'POST',
  })
  const data = await readJsonResponse<{ project: ProjectDetail | null; segments: ProjectSegment[] } | { error?: string }>(
    response,
  )

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not generate project segments.' : 'Could not generate project segments.',
    )
  }

  return data as { project: ProjectDetail | null; segments: ProjectSegment[] }
}

export async function saveProjectSegments(
  projectId: string,
  segments: Array<{ id: string; targetText: string }>,
) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/segments`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ segments }),
  })
  const data = await readJsonResponse<{ project: ProjectDetail | null; segments: ProjectSegment[] } | { error?: string }>(
    response,
  )

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not save project segments.' : 'Could not save project segments.')
  }

  return data as { project: ProjectDetail | null; segments: ProjectSegment[] }
}

export async function fetchTranslationMemories(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/translation-memories`, { signal })
  const data = await readJsonResponse<TranslationMemoriesResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not load translation memories.' : 'Could not load translation memories.',
    )
  }

  return (data as TranslationMemoriesResponse).translationMemories
}

export async function fetchTranslateProviders(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/translate-providers`, { signal })
  const data = await readJsonResponse<TranslateProvidersResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not load translate providers.' : 'Could not load translate providers.',
    )
  }

  return data as TranslateProvidersResponse
}

export async function saveProject(projectId: string | null, formValues: ProjectFormValues, documentFile?: File | null) {
  const requestInit: RequestInit = projectId
    ? {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formValues),
      }
    : {
        method: 'POST',
        body: createProjectFormData(formValues, documentFile),
      }

  const response = await fetch(
    projectId ? `${apiBaseUrl}/api/projects/${projectId}` : `${apiBaseUrl}/api/projects`,
    requestInit,
  )

  const data = await readJsonResponse<ProjectSummary | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not save project.' : 'Could not save project.')
  }

  return data as ProjectSummary
}

export async function deleteProject(projectId: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response)
    throw new Error(data.error ?? 'Could not delete project.')
  }
}

export async function autoTranslateProject(projectId: string, providerName: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/auto-translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerName }),
  })

  const data = await readJsonResponse<{ message: string; project: ProjectDetail | null } | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not start auto translate.' : 'Could not start auto translate.',
    )
  }

  return data as { message: string; project: ProjectDetail | null }
}

export async function cancelAutoTranslateProject(projectId: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/auto-translate/cancel`, {
    method: 'POST',
  })

  const data = await readJsonResponse<{ message: string; project: ProjectDetail | null } | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not cancel auto translate.' : 'Could not cancel auto translate.',
    )
  }

  return data as { message: string; project: ProjectDetail | null }
}

export async function inlineTranslateProjectSegment(projectId: string, segmentId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/segments/${segmentId}/inline-translate`, {
    method: 'POST',
    signal,
  })
  const data = await readJsonResponse<InlineTranslatedProjectSegmentResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not inline translate the segment.' : 'Could not inline translate the segment.',
    )
  }

  return data as InlineTranslatedProjectSegmentResponse
}

export async function confirmProjectSegment(projectId: string, segmentId: string, targetText: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/segments/${segmentId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetText }),
  })
  const data = await readJsonResponse<ConfirmedProjectSegmentResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not confirm the segment.' : 'Could not confirm the segment.',
    )
  }

  return data as ConfirmedProjectSegmentResponse
}

export async function mergeProjectSegments(projectId: string, segmentIds: string[]) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/segments/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ segmentIds }),
  })
  const data = await readJsonResponse<MergedProjectSegmentsResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not merge the selected segments.' : 'Could not merge the selected segments.',
    )
  }

  return data as MergedProjectSegmentsResponse
}

export async function splitProjectSegment(projectId: string, segmentId: string, splitIndex: number) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/segments/${segmentId}/split`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ splitIndex }),
  })
  const data = await readJsonResponse<SplitProjectSegmentResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data ? data.error ?? 'Could not split the segment.' : 'Could not split the segment.',
    )
  }

  return data as SplitProjectSegmentResponse
}

export async function exportProjectDocument(projectId: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/export`)

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = await readJsonResponse<{ error?: string }>(response)
      throw new Error(data.error ?? 'Could not export project document.')
    }

    throw new Error('Could not export project document.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i)

  return {
    blob,
    fileName: fileNameMatch?.[1] ?? 'project.translated',
  }
}

export async function attachProjectTranslationMemory(
  projectId: string,
  payload: {
    translationMemoryId: string
    accessMode: 'read' | 'write'
    priority: number
  },
) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/translation-memories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await readJsonResponse<ProjectTranslationMemoryConfig | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data
        ? data.error ?? 'Could not attach translation memory.'
        : 'Could not attach translation memory.',
    )
  }

  return data as ProjectTranslationMemoryConfig
}

export async function updateProjectTranslationMemory(
  projectId: string,
  translationMemoryId: string,
  payload: {
    accessMode: 'read' | 'write'
    priority: number
  },
) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/translation-memories/${translationMemoryId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      translationMemoryId,
      ...payload,
    }),
  })

  const data = await readJsonResponse<ProjectTranslationMemoryConfig | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data
        ? data.error ?? 'Could not update translation memory configuration.'
        : 'Could not update translation memory configuration.',
    )
  }

  return data as ProjectTranslationMemoryConfig
}

export async function deleteProjectTranslationMemory(projectId: string, translationMemoryId: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/translation-memories/${translationMemoryId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response)
    throw new Error(data.error ?? 'Could not delete translation memory configuration.')
  }
}

function createProjectFormData(formValues: ProjectFormValues, documentFile?: File | null) {
  const formData = new FormData()
  formData.append('name', formValues.name)
  formData.append('description', formValues.description)
  formData.append('sourceLang', formValues.sourceLang)
  formData.append('targetLang', formValues.targetLang)

  if (documentFile) {
    formData.append('file', documentFile)
  }

  return formData
}
