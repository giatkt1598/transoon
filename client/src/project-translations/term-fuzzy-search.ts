import type { ProjectTerm } from "../app/types"
import {
  TERM_FUZZY_MATCH_MAX_RESULTS,
  TERM_FUZZY_MATCH_THRESHOLD,
} from "./constants"

export type FuzzyMatchedProjectTerm = {
  term: ProjectTerm
  score: number
}

export function searchFuzzyProjectTerms(
  sourceText: string,
  projectTerms: ProjectTerm[],
  threshold = TERM_FUZZY_MATCH_THRESHOLD,
): FuzzyMatchedProjectTerm[] {
  const normalizedSourceText = normalizeTermSourceText(sourceText)
  if (!normalizedSourceText) {
    return []
  }

  return projectTerms
    .map((term) => ({
      term,
      score: getTermSimilarityScore(
        normalizedSourceText,
        normalizeTermSourceText(term.sourceTerm),
      ),
    }))
    .filter((match) => match.score >= threshold)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.term.accessMode !== right.term.accessMode) {
        return left.term.accessMode === "write" ? -1 : 1
      }

      if (left.term.priority !== right.term.priority) {
        return left.term.priority - right.term.priority
      }

      return left.term.sourceTerm.localeCompare(right.term.sourceTerm)
    })
    .slice(0, TERM_FUZZY_MATCH_MAX_RESULTS)
}

export function getAppliedTermMatchScore(
  sourceText: string,
  targetText: string,
  projectTerms: ProjectTerm[],
) {
  const normalizedTargetText = normalizeTermSourceText(targetText)
  if (!normalizedTargetText) {
    return null
  }

  const normalizedSourceText = normalizeTermSourceText(sourceText)
  const matchedTerm = projectTerms
    .map((term) => ({
      term,
      score: getTermSimilarityScore(
        normalizedSourceText,
        normalizeTermSourceText(term.sourceTerm),
      ),
    }))
    .find(
      (match) =>
        normalizeTermSourceText(match.term.targetTerm) === normalizedTargetText,
    )

  return matchedTerm?.score ?? null
}

export function normalizeTermSourceText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function getTermSimilarityScore(left: string, right: string) {
  if (!left || !right) {
    return 0
  }

  if (left === right) {
    return 1
  }

  const maxLength = Math.max(left.length, right.length)
  if (maxLength === 0) {
    return 1
  }

  const distance = getLevenshteinDistance(left, right)
  return 1 - distance / maxLength
}

function getLevenshteinDistance(left: string, right: string) {
  const previousRow = new Array(right.length + 1)
  const currentRow = new Array(right.length + 1)

  for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
    previousRow[rightIndex] = rightIndex
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    currentRow[0] = leftIndex

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1

      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      )
    }

    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previousRow[rightIndex] = currentRow[rightIndex]
    }
  }

  return previousRow[right.length]
}
