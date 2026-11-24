import { getGeminiClient, GEMINI_MODEL, extractJson, setCorsHeaders } from './_gemini.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ai = getGeminiClient(req);
    const { targetWords = [], userSentence = '', level = 'HSK2' } = req.body || {};

    if (!userSentence.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập câu tiếng Trung bạn đặt.' });
    }

    const wordsSummary = targetWords
      .map((w) => `${w.hanzi} (${w.pinyin}: ${w.meaning})`)
      .join(', ');

    const prompt = `Bạn là giáo viên tiếng Trung chuẩn HSK 3.0. Học viên trình độ ${level} vừa làm bài tập đặt câu với từ khóa yêu cầu.
- Từ khóa bắt buộc: ${wordsSummary || '(tự do)'}
- Câu của học viên: """${userSentence}"""

Hãy kiểm tra xem học viên đã dùng đúng từ khóa, đúng ngữ pháp, tự nhiên như người bản xứ chưa. Chấm điểm trên thang 10 và sửa lỗi chi tiết bằng tiếng Việt.
Trả về CHỈ JSON thuần theo đúng cấu trúc:
{
  "score": 9,
  "used_target_words": true,
  "grammar_feedback": "Nhận xét chi tiết điểm tốt và lỗi sai ngữ pháp/từ vựng/trật tự từ (bằng tiếng Việt).",
  "corrected_sentence": "Câu đã chỉnh sửa chuẩn xác nhất bằng chữ Hán giản thể",
  "corrected_pinyin": "Pinyin có dấu thanh đầy đủ của câu đã sửa",
  "corrected_vi": "Dịch nghĩa tiếng Việt của câu đã sửa",
  "natural_alternatives": [
    {
      "zh": "Cách diễn đạt tự nhiên như người bản xứ 1",
      "pinyin": "pinyin có dấu thanh",
      "vi": "nghĩa tiếng Việt"
    },
    {
      "zh": "Cách diễn đạt tự nhiên 2",
      "pinyin": "pinyin có dấu thanh",
      "vi": "nghĩa tiếng Việt"
    }
  ],
  "grammar_tip": "1 mẹo ngữ pháp HSK 3.0 ngắn gọn rút ra từ câu này"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const parsed = extractJson(response.text);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[api/grade]', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Lỗi khi chấm câu với AI.',
      code: err.code || 'AI_ERROR',
    });
  }
}
