import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import { useTranslationApp } from "../app/translation-app-context";
import { formatTimer } from "../app/utils";
import { ProgressCard } from "./progress-card";

const showCopyBuildPrompt =
  import.meta.env.VITE_SHOW_COPY_BUILD_PROMPT !== "false";

const selectMenuProps = {
  transitionDuration: 180,
  PaperProps: {
    className: "select-menu-paper",
    sx: {
      opacity: 1,
      backgroundColor: "#fffaf2",
      backgroundImage: "none",
      backdropFilter: "none",
      boxShadow: "0 18px 45px rgba(73, 52, 34, 0.1)",
      "& .MuiMenuItem-root": {
        opacity: 1,
      },
    },
  },
} as const;

export function DocumentIntakePanel() {
  const {
    languagesData,
    translateProvidersData,
    file,
    sourceLanguage,
    targetLanguage,
    providerName,
    isSubmitting,
    isCopyingPrompt,
    elapsedSeconds,
    progress,
    error,
    setFile,
    setSourceLanguage,
    setTargetLanguage,
    setProviderName,
    handleSubmit,
    handleCopyBuildPrompt,
  } = useTranslationApp();

  return (
    <Paper
      component="form"
      className="panel form-panel"
      elevation={0}
      onSubmit={handleSubmit}
    >
      <Box className="panel-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            Feature 01
          </Typography>
          <Typography component="h2" variant="h4">
            Document Intake
          </Typography>
        </Box>
      </Box>

      <Box className="field upload-field">
        <Typography component="span">Document file</Typography>
        <Button
          component="label"
          variant="outlined"
          sx={{
            justifyContent: "flex-start",
            borderRadius: "14px",
            borderColor: "#d8c2a8",
            backgroundColor: "#fff",
            color: "#291d13",
            padding: "14px 16px",
            fontWeight: 400,
            "&:hover": {
              borderColor: "#d97f37",
              backgroundColor: "#fffaf2",
            },
          }}
        >
          {file ? "Choose another file" : "Choose document"}
          <input
            hidden
            type="file"
            accept=".txt,.docx,.xlsx,.csv,.pptx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Button>
        <Typography component="small">
          {file
            ? `Selected file: ${file.name}`
            : "Supported in this version: `.txt`, `.docx`, `.xlsx`, `.csv`, `.pptx`"}
        </Typography>
      </Box>

      <Box className="field-grid">
        <FormControl className="field" fullWidth>
          <InputLabel
            id="source-language-label"
            shrink
            sx={{ position: "static", transform: "none", mb: 1.25 }}
          >
            Source language
          </InputLabel>
          <Select
            labelId="source-language-label"
            value={sourceLanguage}
            notched={false}
            MenuProps={selectMenuProps}
            onChange={(event) => setSourceLanguage(event.target.value)}
            sx={{
              borderRadius: "14px",
              backgroundColor: "#fff",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#d8c2a8",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#d97f37",
              },
            }}
          >
            {languagesData.languages.map((language) => (
              <MenuItem key={language.code} value={language.code}>
                {language.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl className="field" fullWidth>
          <InputLabel
            id="target-language-label"
            shrink
            sx={{ position: "static", transform: "none", mb: 1.25 }}
          >
            Target language
          </InputLabel>
          <Select
            labelId="target-language-label"
            value={targetLanguage}
            notched={false}
            MenuProps={selectMenuProps}
            onChange={(event) => setTargetLanguage(event.target.value)}
            sx={{
              borderRadius: "14px",
              backgroundColor: "#fff",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#d8c2a8",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#d97f37",
              },
            }}
          >
            {languagesData.languages
              .filter((language) => language.code !== "auto")
              .map((language) => (
                <MenuItem key={language.code} value={language.code}>
                  {language.label}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Box>

      <FormControl className="field" fullWidth>
        <InputLabel
          id="translate-provider-label"
          shrink
          sx={{ position: "static", transform: "none", mb: 1.25 }}
        >
          Translate provider
        </InputLabel>
        <Select
          labelId="translate-provider-label"
          value={providerName}
          notched={false}
          MenuProps={selectMenuProps}
          onChange={(event) => setProviderName(event.target.value)}
          disabled={translateProvidersData.translateProviders.length === 0}
          sx={{
            borderRadius: "14px",
            backgroundColor: "#fff",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "#d8c2a8",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "#d97f37",
            },
          }}
        >
          {translateProvidersData.translateProviders.map((provider) => (
            <MenuItem key={provider.name} value={provider.name}>
              {provider.name}
            </MenuItem>
          ))}
        </Select>
        <Typography component="small">
          {translateProvidersData.translateProviders.find(
            (provider) => provider.name === providerName,
          )?.description ??
            (translateProvidersData.translateProviders.length === 0
              ? "Translate providers are loaded only from the server API."
              : "Select a translation provider.")}
        </Typography>
      </FormControl>

      {showCopyBuildPrompt ? (
        <Button
          className="secondary-button"
          type="button"
          onClick={handleCopyBuildPrompt}
          disabled={isCopyingPrompt || !providerName}
          variant="outlined"
          sx={{ my: 2 }}
        >
          {isCopyingPrompt ? "Copying buildPrompt..." : "Copy buildPrompt"}
        </Button>
      ) : null}

      <Button
        className="submit-button"
        type="submit"
        disabled={isSubmitting || !providerName}
        variant="contained"
        size="large"
      >
        {isSubmitting
          ? `Processing document (${formatTimer(elapsedSeconds)})...`
          : "Translate document"}
      </Button>

      {isSubmitting && progress ? <ProgressCard progress={progress} /> : null}
      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Paper>
  );
}
