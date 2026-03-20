export type TranslationStatus = "pending" | "translated" | "reviewed" | "rejected";

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

export type ProjectEntity = {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  createdAt: string;
};

export type DocumentEntity = {
  id: string;
  projectId: string;
  fileName: string;
  documentType: string | null;
  contentSha256: string | null;
  createdAt: string;
};

export type SegmentEntity = {
  id: string;
  documentId: string;
  externalSegmentId: string;
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
