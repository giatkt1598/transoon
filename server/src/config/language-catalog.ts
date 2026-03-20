import { appConfig } from "./app-config";

export const languageCatalog = {
  defaultSourceLanguage: appConfig.defaultSourceLanguage,
  defaultTargetLanguage: appConfig.defaultTargetLanguage,
  defaultTranslateProvider: appConfig.defaultTranslateProvider,
  languages: [
    { code: "auto", label: "Auto detect" },
    { code: "en", label: "English" },
    { code: "ja", label: "Japanese" },
    { code: "vi", label: "Vietnamese" },
    { code: "zh-CN", label: "Chinese (Simplified)" },
    { code: "ko", label: "Korean" },
    { code: "fr", label: "French" },
    { code: "de", label: "German" },
    { code: "es", label: "Spanish" },
  ],
} as const;
