import DonutLargeRoundedIcon from "@mui/icons-material/DonutLargeRounded";
import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import "./loading-skeleton.css";

type LoadingExperienceProps = {
  title: string;
  subtitle: string;
  mode?: "page" | "table";
  showText?: boolean;
  showProgressValue?: boolean;
};

export function LoadingRouteSkeleton() {
  return (
    <LoadingExperience
      mode="page"
      title="Preparing workspace"
      subtitle="Loading navigation and screen context."
    />
  );
}

export function LoadingPageSkeleton() {
  return (
    <LoadingExperience
      mode="page"
      title="Loading detail view"
      subtitle="Syncing data and preparing the workspace."
    />
  );
}

export function LoadingCardSkeleton({
  rows = 4,
}: {
  rows?: number;
}) {
  return (
    <LoadingExperience
      mode="page"
      title="Loading content"
      subtitle={`Preparing related information for ${rows} sections.`}
    />
  );
}

export function LoadingTableSkeleton({
  rows = 5,
  columns = 4,
  showToolbar = true,
}: {
  rows?: number;
  columns?: number;
  showToolbar?: boolean;
}) {
  return (
    <LoadingExperience
      mode="table"
      title="Loading data"
      subtitle={`Building ${rows} rows, ${columns} columns, and ${showToolbar ? "toolbar" : "grid"} state.`}
      showText={false}
      showProgressValue={false}
    />
  );
}

export function LoadingPreviewSkeleton() {
  return (
    <LoadingExperience
      mode="table"
      title="Rendering preview"
      subtitle="Composing document content for preview."
      showText={false}
      showProgressValue={false}
    />
  );
}

export function LoadingFormSkeleton({
  fields = 3,
}: {
  fields?: number;
}) {
  return (
    <LoadingExperience
      mode="page"
      title="Loading form"
      subtitle={`Preparing ${fields} editable controls.`}
    />
  );
}

function LoadingExperience({
  title,
  subtitle,
  mode = "page",
  showText = true,
  showProgressValue = true,
}: LoadingExperienceProps) {
  const [progress, setProgress] = useState(22);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProgress((currentValue) => {
        if (currentValue >= 94) {
          return 28;
        }

        return Math.min(94, currentValue + Math.max(4, (98 - currentValue) * 0.1));
      });
    }, 260);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <Box
      className={`loading-experience loading-experience-${mode}`}
      role="status"
      aria-live="polite"
    >
      <Box className="loading-experience-icon-shell">
        <DonutLargeRoundedIcon className="loading-experience-icon" />
      </Box>

      {showText ? (
        <Box className="loading-experience-copy">
          <Typography component="h3" className="loading-experience-title">
            {title}
          </Typography>
          <Typography component="p" className="loading-experience-subtitle">
            {subtitle}
          </Typography>
        </Box>
      ) : null}

      <Box className="loading-experience-progress">
        <Box className="loading-experience-progress-track">
          <Box
            className="loading-experience-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </Box>
        {showProgressValue ? (
          <Typography component="span" className="loading-experience-progress-value">
            {`${Math.round(progress)}%`}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
