export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  defaultSourceLanguage: "en",
  defaultTargetLanguage: "ja",
  defaultTranslateProvider: "Google Translate",
} as const;
