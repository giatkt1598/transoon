import { Box, Paper, Typography } from "@mui/material";
import { useMemo } from "react";
import type { ProjectSegment, ProjectTerm } from "../../app/types";

type ProjectTranslationSummarySectionProps = {
  totalSegments: number;
  translatedSegmentCount: number;
  segments: ProjectSegment[];
  projectTerms: ProjectTerm[];
};

export function ProjectTranslationSummarySection({
  totalSegments,
  translatedSegmentCount,
  segments,
  projectTerms,
}: ProjectTranslationSummarySectionProps) {
  const summaryItems = useMemo(() => {
    const confirmedCount = segments.filter((segment) => segment.translationStatus === "reviewed").length;
    const translatedOnlyCount = segments.filter((segment) => segment.translationStatus === "translated").length;
    const pendingCount = segments.filter((segment) => segment.translationStatus === "pending").length;
    const glossaryItemCountInSegments = segments.reduce((total, segment) => total + segment.appliedGlossary.length, 0);
    const normalizedProjectTermSources = new Set(projectTerms.map((term) => term.sourceTermNormalized));
    const translationMemoryItemCountInSegments = segments.filter((segment) =>
      normalizedProjectTermSources.has(segment.sourceText.trim().toLowerCase()),
    ).length;

    return [
      {
        label: "Segments",
        value: totalSegments,
      },
      {
        label: "Confirmed",
        value: segments.length > 0 ? confirmedCount : 0,
      },
      {
        label: "Auto Translated",
        value: segments.length > 0 ? translatedOnlyCount : translatedSegmentCount,
      },
      {
        label: "Pending",
        value: segments.length > 0 ? pendingCount : Math.max(0, totalSegments - translatedSegmentCount),
      },
      {
        label: "Used Translation memories",
        value: translationMemoryItemCountInSegments,
      },
      {
        label: "Used Glossaries",
        value: glossaryItemCountInSegments,
      },
    ];
  }, [projectTerms, segments, totalSegments, translatedSegmentCount]);

  return (
    <Paper className="detail-section-card" elevation={0}>
      <Box className="panel-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            Translation
          </Typography>
          <Typography component="h2" variant="h4">
            Translation Summary
          </Typography>
        </Box>
      </Box>

      <Box className="detail-summary-grid">
        {summaryItems.map((item) => (
          <Box key={item.label} className="detail-summary-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default ProjectTranslationSummarySection;
