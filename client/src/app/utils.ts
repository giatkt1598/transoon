import type { LanguageOption } from './types'

export function formatProcessingTime(processingTimeMs: number) {
  if (processingTimeMs < 1000) {
    return `${processingTimeMs} ms`
  }

  return `${(processingTimeMs / 1000).toFixed(2)} s`
}

export function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function loadStoredValue(storageKey: string, fallbackValue: string) {
  const storedValue = localStorage.getItem(storageKey)
  return storedValue && storedValue.trim().length > 0 ? storedValue : fallbackValue
}

export function hasLanguageOption(
  languages: LanguageOption[],
  selectedCode: string,
) {
  return languages.some((language) => language.code === selectedCode)
}
