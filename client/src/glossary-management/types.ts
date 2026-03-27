export type GlossaryFormValues = {
  name: string
  sourceLanguage: string
  targetLanguage: string
}

export type GlossaryItemDraft = {
  source: string
  target: string
  caseSensitive: boolean
  wholeWord: boolean
  priority: number
}
