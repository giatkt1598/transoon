from fastapi import FastAPI
from pydantic import BaseModel
import os
# Optional: change cache folder (avoid C disk full)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HF_CACHE = os.path.join(BASE_DIR, "hf_cache")
os.environ["HF_HOME"] = HF_CACHE
os.environ["TRANSFORMERS_CACHE"] = HF_CACHE

from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch
from langdetect import detect

# ===== LANGUAGE MAPPING =====
LANG_MAP = {
    "en": "eng_Latn",
    "vi": "vie_Latn",
    "ja": "jpn_Jpan",
    "zh-CN": "zho_Hans",
    "ko": "kor_Hang",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "es": "spa_Latn",
}

def resolve_lang(code: str, fallback="eng_Latn"):
    if code == "auto":
        return None
    return LANG_MAP.get(code, fallback)

# ===== CONFIG =====
# MODEL_NAME = "facebook/nllb-200-distilled-600M"
MODEL_NAME = "facebook/nllb-200-1.3B"
# MODEL_NAME = "facebook/nllb-200-3.3B"


# ===== INIT =====
app = FastAPI(title="NLLB Translation API")

print("Loading model...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(
    MODEL_NAME,
    dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    low_cpu_mem_usage=True,
    device_map="auto" if torch.cuda.is_available() else None
)

device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)

print(f"Model loaded on {device}")

# ===== REQUEST MODELS =====
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "eng_Latn"
    target_lang: str = "vie_Latn"


class BatchRequest(BaseModel):
    texts: list[str]
    source_lang: str = "eng_Latn"
    target_lang: str = "vie_Latn"


# ===== CORE FUNCTION =====
@torch.inference_mode()
def translate_texts(texts, source_lang, target_lang):
    # ===== detect source =====
    if source_lang == "auto":
        detected = detect(texts[0])
        source_lang = resolve_lang(detected)
    else:
        source_lang = resolve_lang(source_lang)

    target_lang = resolve_lang(target_lang, "vie_Latn")

    if source_lang is None:
        source_lang = "eng_Latn"  # fallback

    tokenizer.src_lang = source_lang

    inputs = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=True
    ).to(device)

    forced_bos_token_id = tokenizer.convert_tokens_to_ids(target_lang)

    outputs = model.generate(
        **inputs,
        forced_bos_token_id=forced_bos_token_id,
        max_length=512
    )

    return tokenizer.batch_decode(outputs, skip_special_tokens=True)

# ===== API =====
@app.get("/")
def root():
    return {"message": "NLLB Translation API is running"}


@app.post("/translate")
def translate(req: TranslateRequest):
    result = translate_texts(
        [req.text],
        req.source_lang,
        req.target_lang
    )

    return {
        "translated_text": result[0]
    }


@app.post("/translate_batch")
def translate_batch(req: BatchRequest):
    results = translate_texts(
        req.texts,
        req.source_lang,
        req.target_lang
    )

    return {
        "translated_texts": results
    }


# ===== HEALTH CHECK =====
@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": device,
        "model": MODEL_NAME
    }