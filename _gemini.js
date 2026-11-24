import { GoogleGenAI } from '@google/genai';

// Primary model recommended by Google Gemini API + retry & fallback chain
export const GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_MODELS = [
  'gemini-3.8-flash-lite',
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-2.5-flash-lite',
];

export function getGeminiClient(req) {
  const headerKey =
    req.headers?.['x-gemini-api-key'] ||
    req.headers?.['X-Gemini-Api-Key'] ||
    '';
  const apiKey =
    (typeof headerKey === 'string' && headerKey.trim()) ||
    process.env.GEMINI_API_KEY ||
    '';

  if (!apiKey) {
    const err = new Error(
      'Chưa cấu hình GEMINI_API_KEY trên máy chủ và chưa nhập Personal Gemini API Key trong trang Cài đặt.'
    );
    err.statusCode = 400;
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  return new GoogleGenAI({ apiKey });
}

export function extractJson(text) {
  if (!text) throw new Error('AI không trả về nội dung.');
  const trimmed = text.trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key, x-gemini-model');
}

function parseErrorStatus(err) {
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.statusCode === 'number') return err.statusCode;
  const msg = String(err?.message || '');
  const m = msg.match(/"code"\s*:\s*(\d{3})/) || msg.match(/\b(400|401|403|404|429|500|502|503|504)\b/);
  return m ? Number(m[1]) : 500;
}

export function formatGeminiError(err) {
  if (err?.code === 'MISSING_API_KEY') {
    return { statusCode: 400, code: 'MISSING_API_KEY', message: err.message };
  }
  const status = parseErrorStatus(err);
  const raw = String(err?.message || '');

  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(raw)) {
    return {
      statusCode: 401,
      code: 'INVALID_API_KEY',
      message: 'Gemini API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại key trong trang Cài đặt.',
    };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return {
      statusCode: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'API Key đang tạm chạm giới hạn lượt gọi/phút của Google Gemini. Vui lòng chờ khoảng 15–30 giây rồi thử lại.',
    };
  }
  if (status === 503 || status === 500 || status === 502 || status === 504 || /UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return {
      statusCode: 503,
      code: 'MODEL_BUSY',
      message: 'Máy chủ Google Gemini (gemini-3.8-flash) đang quá tải tạm thời. Hãy bấm thử lại sau vài giây nhé.',
    };
  }
  return {
    statusCode: status >= 400 && status < 600 ? status : 500,
    code: 'AI_ERROR',
    message: raw.length > 220 ? 'Không thể kết nối tới trợ lý AI lúc này. Vui lòng thử lại sau giây lát.' : raw || 'Lỗi khi gọi trợ lý AI.',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini with automatic retry on transient 503/429 spikes on the primary model
 * (gemini-3.8-flash) and automatic fallback across alternative Flash models.
 */
export async function generateJsonWithFallback(req, ai, prompt, { temperature = 0.5 } = {}) {
  const headerModel = req.headers?.['x-gemini-model'] || req.headers?.['X-Gemini-Model'] || '';
  const preferred =
    (typeof headerModel === 'string' && headerModel.trim()) ||
    process.env.GEMINI_MODEL ||
    GEMINI_MODEL;

  const modelChain = Array.from(new Set([preferred, ...FALLBACK_MODELS].filter(Boolean)));
  let lastErr = null;

  for (let i = 0; i < modelChain.length; i++) {
    const model = modelChain[i];
    // Retry primary model twice on transient 503 high-demand spikes before switching
    const maxAttempts = i === 0 ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature,
          },
        });
        const parsed = extractJson(response.text);
        return { data: parsed, model };
      } catch (err) {
        lastErr = err;
        const status = parseErrorStatus(err);
        const raw = String(err?.message || '');

        // Immediately abort on invalid API key
        if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(raw)) {
          throw err;
        }

        const isTransient =
          status === 503 ||
          status === 500 ||
          status === 502 ||
          status === 504 ||
          /UNAVAILABLE|high demand|overloaded/i.test(raw);

        if (isTransient && attempt < maxAttempts) {
          console.warn(`[api/_gemini] Model "${model}" busy (${status}), retry ${attempt}/${maxAttempts - 1}...`);
          await sleep(650 * attempt);
          continue;
        }

        const canFallback =
          isTransient ||
          status === 404 ||
          status === 429 ||
          /NOT_FOUND|not found|is not supported|no longer available/i.test(raw);

        if (!canFallback) {
          throw err;
        }

        console.warn(`[api/_gemini] Model "${model}" failed (${status}), falling back...`);
        break;
      }
    }
  }

  throw lastErr || new Error('Không có model Gemini khả dụng.');
}
