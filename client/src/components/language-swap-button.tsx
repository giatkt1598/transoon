import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { IconButton, Tooltip } from "@mui/material";

type LanguageSwapButtonProps = {
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

export function LanguageSwapButton({
  disabled = false,
  disabledReason,
  onClick,
}: LanguageSwapButtonProps) {
  const title = disabled
    ? disabledReason ?? "This language pair cannot be swapped."
    : "Swap source and target languages";

  return (
    <Tooltip title={title}>
      <span className="language-swap-button-shell">
        <IconButton
          className="language-swap-button"
          aria-label="Swap source and target languages"
          onClick={onClick}
          disabled={disabled}
        >
          <SwapHorizRoundedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
