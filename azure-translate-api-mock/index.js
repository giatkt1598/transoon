"use strict";

const crypto = require("crypto");
const express = require("express");

const DEFAULT_PORT = Number(process.env.PORT ?? 3201);
const DEFAULT_API_VERSION = "3.0";
const DEFAULT_SUBSCRIPTION_KEY = process.env.AZURE_TRANSLATE_MOCK_KEY ?? "mock-subscription-key";
const DEFAULT_REGION = process.env.AZURE_TRANSLATE_MOCK_REGION ?? "southeastasia";

const supportedLanguages = {
  translation: {
    en: { name: "English", nativeName: "English", dir: "ltr" },
    vi: { name: "Vietnamese", nativeName: "Tiếng Việt", dir: "ltr" },
    ja: { name: "Japanese", nativeName: "日本語", dir: "ltr" },
    "zh-Hans": { name: "Chinese Simplified", nativeName: "简体中文", dir: "ltr" },
    ko: { name: "Korean", nativeName: "한국어", dir: "ltr" },
    fr: { name: "French", nativeName: "Français", dir: "ltr" },
    de: { name: "German", nativeName: "Deutsch", dir: "ltr" },
    es: { name: "Spanish", nativeName: "Español", dir: "ltr" },
  },
  transliteration: {},
  dictionary: {},
};

function createAzureTranslateApiMockApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      name: "azure-translate-api-mock",
      status: "ok",
      apiVersion: DEFAULT_API_VERSION,
      region: DEFAULT_REGION,
    });
  });

  app.get("/languages", (req, res) => {
    const versionError = validateApiVersion(req.query["api-version"]);
    if (versionError) {
      res.status(400).json(versionError);
      return;
    }

    res.setHeader("X-RequestId", crypto.randomUUID());
    res.json(supportedLanguages);
  });

  app.post("/detect", (req, res) => {
    const validationError = validateAuthorizedJsonRequest(req);
    if (validationError) {
      res.status(validationError.status).json(validationError.body);
      return;
    }

    const texts = normalizeRequestTexts(req.body);
    if (!texts) {
      res.status(400).json(createErrorBody(400036, "The request body must be a JSON array of text items."));
      return;
    }

    res.setHeader("X-RequestId", crypto.randomUUID());
    res.json(
      texts.map((text) => ({
        language: detectLanguage(text),
        score: 1,
        isTranslationSupported: true,
        isTransliterationSupported: false,
      })),
    );
  });

  app.post("/translate", (req, res) => {
    const validationError = validateAuthorizedJsonRequest(req);
    if (validationError) {
      res.status(validationError.status).json(validationError.body);
      return;
    }

    const targetLanguages = normalizeTargetLanguages(req.query.to);
    if (targetLanguages.length === 0) {
      res.status(400).json(createErrorBody(400077, "At least one target language is required."));
      return;
    }

    const texts = normalizeRequestTexts(req.body);
    if (!texts) {
      res.status(400).json(createErrorBody(400036, "The request body must be a JSON array of text items."));
      return;
    }

    const explicitSourceLanguage =
      typeof req.query.from === "string" && req.query.from.trim().length > 0
        ? req.query.from.trim()
        : null;
    const includeSentenceLength = String(req.query.includeSentenceLength ?? "").toLowerCase() === "true";
    const includeAlignment = String(req.query.includeAlignment ?? "").toLowerCase() === "true";
    const toScript =
      typeof req.query.toScript === "string" && req.query.toScript.trim().length > 0
        ? req.query.toScript.trim()
        : null;

    res.setHeader("X-RequestId", crypto.randomUUID());
    res.setHeader("X-MT-System", "AzureTranslateApiMock");
    res.setHeader("X-Metered-Usage", String(texts.length));

    res.json(
      texts.map((text) => {
        const sourceLanguage = explicitSourceLanguage ?? detectLanguage(text);
        const translations = targetLanguages.map((targetLanguage) => {
          const translatedText = buildMockTranslation(text, sourceLanguage, targetLanguage);
          const translation = {
            text: translatedText,
            to: targetLanguage,
          };

          if (includeAlignment) {
            translation.alignment = {
              proj: buildAlignmentProjection(text, translatedText),
            };
          }

          if (toScript) {
            translation.transliteration = {
              script: toScript,
              text: translatedText,
            };
          }

          return translation;
        });

        const responseItem = {
          translations,
        };

        if (!explicitSourceLanguage) {
          responseItem.detectedLanguage = {
            language: sourceLanguage,
            score: 1,
          };
        }

        if (includeSentenceLength) {
          responseItem.sentLen = {
            srcSentLen: [String(text ?? "").length],
            transSentLen: translations.map((translation) => translation.text.length),
          };
        }

        return responseItem;
      }),
    );
  });

  return app;
}

function validateAuthorizedJsonRequest(req) {
  const versionError = validateApiVersion(req.query["api-version"]);
  if (versionError) {
    return {
      status: 400,
      body: versionError,
    };
  }

  const subscriptionKey = req.get("Ocp-Apim-Subscription-Key");
  if (!subscriptionKey || subscriptionKey.trim().length === 0) {
    return {
      status: 401,
      body: createErrorBody(401000, "Missing Ocp-Apim-Subscription-Key header."),
    };
  }

  if (subscriptionKey !== DEFAULT_SUBSCRIPTION_KEY) {
    return {
      status: 403,
      body: createErrorBody(403000, "Invalid subscription key."),
    };
  }

  const contentType = req.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      status: 415,
      body: createErrorBody(415000, "Content-Type must be application/json."),
    };
  }

  return null;
}

function validateApiVersion(value) {
  if (value === undefined || value === DEFAULT_API_VERSION) {
    return null;
  }

  return createErrorBody(
    400070,
    `Unsupported api-version "${String(value)}". Only ${DEFAULT_API_VERSION} is implemented in the mock.`,
  );
}

function normalizeRequestTexts(body) {
  if (!Array.isArray(body)) {
    return null;
  }

  const texts = [];
  for (const item of body) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const value =
      typeof item.Text === "string"
        ? item.Text
        : typeof item.text === "string"
          ? item.text
          : null;

    if (value === null) {
      return null;
    }

    texts.push(value);
  }

  return texts;
}

function normalizeTargetLanguages(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeTargetLanguages(item));
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function detectLanguage(text) {
  const value = String(text ?? "");

  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u.test(value)) {
    return /[\u3040-\u30ff]/u.test(value) ? "ja" : "zh-Hans";
  }

  if (/[\uac00-\ud7af]/u.test(value)) {
    return "ko";
  }

  if (/[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u.test(value)) {
    return "vi";
  }

  return "en";
}

function buildMockTranslation(text, from, to) {
  const value = String(text ?? "");
  if (value.trim().length === 0) {
    return value;
  }

  return `[Azure Mock ${from}->${to}] ${value}`;
}

function buildAlignmentProjection(sourceText, translatedText) {
  const sourceLength = Math.max(0, String(sourceText ?? "").length - 1);
  const translatedLength = Math.max(0, String(translatedText ?? "").length - 1);
  return `0:${sourceLength}-0:${translatedLength}`;
}

function createErrorBody(code, message) {
  return {
    error: {
      code,
      message,
    },
  };
}

if (require.main === module) {
  const app = createAzureTranslateApiMockApp();
  app.listen(DEFAULT_PORT, () => {
    console.log(`Azure Translate API mock listening at http://localhost:${DEFAULT_PORT}`);
  });
}

module.exports = {
  createAzureTranslateApiMockApp,
};
