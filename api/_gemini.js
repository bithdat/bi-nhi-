import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.8-flash';

export function getGeminiClient(req) {
  const headerKey =
    req.headers?.['x-gemini-api-key'] ||
    req.headers?.['X-Gemini-Api-Key'] ||
    '';
  const apiKey = (typeof headerKey === 'string' && headerKey.trim()) || process.env.GEMINI_API_KEY || '';

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
  // Strip optional markdown code fences
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');
}
