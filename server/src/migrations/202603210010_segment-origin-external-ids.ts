import type { SqlMigrationDefinition } from "./migration";

export const segmentOriginExternalIdsMigration: SqlMigrationDefinition = {
  id: "202603210010_SegmentOriginExternalIds",
  productVersion: "1.0.0",
  name: "Add origin external segment ids for merge and split tracking",
  up: `
    ALTER TABLE segments
    ADD COLUMN originExternalSegmentIdsJson TEXT NULL;

    UPDATE segments
    SET originExternalSegmentIdsJson = json_array(externalSegmentId)
    WHERE originExternalSegmentIdsJson IS NULL;
  `,
  down: ``,
};
