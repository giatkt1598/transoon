import { apiBaseUrl } from '../app/config'
import type { AppSettings, TranslateProvidersResponse } from '../app/types'

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

export async function fetchSettings(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/settings`, { signal })
  const data = await readJsonResponse<AppSettings | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load settings.' : 'Could not load settings.')
  }

  return data as AppSettings
}

export async function saveSettings(settings: AppSettings) {
  const response = await fetch(`${apiBaseUrl}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  })
  const data = await readJsonResponse<AppSettings | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not save settings.' : 'Could not save settings.')
  }

  return data as AppSettings
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
