import { apiBaseUrl } from '../app/config'
import type {
  LanguagesResponse,
  ProjectDetail,
  ProjectSummary,
  ProjectsResponse,
  ProjectTranslationMemoryConfig,
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
