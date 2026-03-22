import type { SqlMigrationDefinition } from "./migration";

export const segmentMergeSupportMigration: SqlMigrationDefinition = {
  id: "202603210008_SegmentMergeSupport",
  productVersion: "1.0.0",
  name: "Add segment merge support",
  up: `
    ALTER TABLE segments
    ADD COLUMN mergedIntoSegmentId TEXT NULL REFERENCES segments(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_segments_document_merged_lookup
      ON segments(documentId, mergedIntoSegmentId, position);
  `,
  down: `
    DROP INDEX IF EXISTS idx_segments_document_merged_lookup;
  `,
};
