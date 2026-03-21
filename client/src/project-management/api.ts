import { apiBaseUrl } from '../app/config'
import type { LanguagesResponse, ProjectSummary, ProjectsResponse } from '../app/types'
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
  sourceLang: fallbackLanguages.defaultSourceLanguage,
  targetLang: fallbackLanguages.defaultTargetLanguage,
}

export function getFallbackLanguages() {
  return fallbackLanguages
}

export async function fetchLanguages(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/languages`, { signal })
  if (!response.ok) {
    throw new Error('Could not load language options.')
  }

  return (await response.json()) as LanguagesResponse
}

export async function fetchProjects(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects`, { signal })
  if (!response.ok) {
    throw new Error('Could not load projects.')
  }

  const data = (await response.json()) as ProjectsResponse
  return data.projects
}

export async function fetchProject(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}`, { signal })
  const data = (await response.json()) as ProjectSummary | { error?: string }

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load project.' : 'Could not load project.')
  }

  return data as ProjectSummary
}

export async function saveProject(projectId: string | null, formValues: ProjectFormValues) {
  const response = await fetch(
    projectId ? `${apiBaseUrl}/api/projects/${projectId}` : `${apiBaseUrl}/api/projects`,
    {
      method: projectId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formValues),
    },
  )

  const data = (await response.json()) as ProjectSummary | { error?: string }
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
    const data = (await response.json()) as { error?: string }
    throw new Error(data.error ?? 'Could not delete project.')
  }
}
