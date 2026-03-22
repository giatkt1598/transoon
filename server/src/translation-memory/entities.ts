export type TranslationStatus = "pending" | "translated" | "reviewed" | "rejected";
export type ProjectStatus = "idle" | "auto-translate-processing";

export type SegmentTokenType =
  | "text"
  | "tag"
  | "placeholder"
  | "line_break"
  | "other";

export type MatchQuality =
  | "unreviewed"
  | "machine"
  | "fuzzy"
  | "exact"
  | "human_approved";

export type TranslationMemoryAccessMode = "read" | "write";

export type AppSettingEntity = {
  key: string;
  value: string;
  updatedAt: string;
};

export type ProjectEntity = {
  id: string;
  name: string;
  description: string;
  sourceLang: string;
  targetLang: string;
  status: ProjectStatus;
  wordCount: number;
  characterCount: number;
  createdAt: string;
  lastModifiedAt: string | null;
};

export type DocumentEntity = {
  id: string;
  projectId: string;
  fileName: string;
  documentType: string | null;
  contentSha256: string | null;
  storagePath: string | null;
  createdAt: string;
};

export type SegmentEntity = {
  id: string;
  documentId: string;
  externalSegmentId: string;
  mergedIntoSegmentId: string | null;
  splitGroupId: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  sourceTextNormalized: string;
  sourceTextHash: string;
  targetText: string;
  targetTextNormalized: string;
  targetTextHash: string | null;
  tokensJson: string;
  position: number;
  translationStatus: TranslationStatus;
  providerName: string | null;
  reviewedByHuman: 0 | 1;
  createdAt: string;
  updatedAt: string;
};

export type TranslationMemoryEntity = {
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  lastModifiedAt: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export type TermEntity = {
  id: string;
  translationMemoryId: string;
  sourceTerm: string;
  sourceTermNormalized: string;
  targetTerm: string;
  targetTermNormalized: string;
  lastModifiedAt: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export type ProjectTranslationMemoryEntity = {
  projectId: string;
  translationMemoryId: string;
  accessMode: TranslationMemoryAccessMode;
  priority: number;
  createdAt: string;
};

export type SegmentTokenEntity = {
  id: number;
  segmentId: string;
  tokenIndex: number;
  tokenType: SegmentTokenType;
  tokenValue: string;
};

export type TranslationUnitEntity = {
  id: string;
  projectId: string | null;
  translationMemoryId: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  sourceTextNormalized: string;
  sourceTextHash: string;
  targetText: string;
  targetTextNormalized: string;
  targetTextHash: string;
  tokensJson: string;
  originDocumentId: string | null;
  originSegmentId: string | null;
  providerName: string | null;
  matchQuality: MatchQuality;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
