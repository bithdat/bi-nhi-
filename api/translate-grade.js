import { getGeminiClient, GEMINI_MODEL, extractJson, setCorsHeaders } from './_gemini.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ai = getGeminiClient(req);
    const { action = 'grade', direction = 'zh-vi', level = 'HSK2', topic = 'Đời sống hàng ngày', sourceText = '', userTranslation = '' } = req.body || {};

    if (action === 'generate') {
      const prompt =
        direction === 'zh-vi'
          ? `Bạn là giảng viên tiếng Trung chuẩn HSK 3.0. Hãy tạo 1 đoạn văn ngắn (2–3 câu, tự nhiên, đúng trình độ ${level}) về chủ đề "${topic}" bằng tiếng Trung giản thể để học viên luyện dịch Trung -> Việt.
Trả về CHỈ JSON thuần hợp lệ theo cấu trúc:
{
  "source_text": "Đoạn văn tiếng Trung giản thể",
  "source_pinyin": "Phiên âm pinyin có dấu thanh đầy đủ",
  "hint": "Gợi ý ngắn về ngữ cảnh hoặc 2-3 từ khóa quan trọng bằng tiếng Việt"
}`
          : `Bạn là giảng viên tiếng Trung chuẩn HSK 3.0. Hãy tạo 1 đoạn văn ngắn tiếng Việt tự nhiên (2–3 câu) phù hợp để học viên trình độ ${level} dịch sang tiếng Trung giản thể, về chủ đề "${topic}".
Trả về CHỈ JSON thuần hợp lệ theo cấu trúc:
{
  "source_text": "Đoạn văn tiếng Việt tự nhiên",
  "source_pinyin": "",
  "hint": "Gợi ý 2-3 cấu trúc ngữ pháp hoặc từ vựng tiếng Trung nên dùng (kèm pinyin)"
}`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const parsed = extractJson(response.text);
      return res.status(200).json(parsed);
    }

    if (!sourceText.trim() || !userTranslation.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ đoạn văn gốc và bản dịch của bạn.' });
    }

    const dirLabel = direction === 'zh-vi' ? 'Tiếng Trung -> Tiếng Việt' : 'Tiếng Việt -> Tiếng Trung';

    const prompt = `Bạn là giám khảo chấm thi và giảng viên biên dịch tiếng Trung HSK 3.0 giàu kinh nghiệm.
Hãy chấm bài dịch sau đây cho học viên trình độ ${level}.
- Chiều dịch: ${dirLabel}
- Văn bản gốc: """${sourceText}"""
- Bản dịch của học viên: """${userTranslation}"""

Yêu cầu đánh giá công tâm, rõ ràng, truyền cảm hứng bằng tiếng Việt.
Trả về CHỈ JSON thuần theo đúng schema sau:
{
  "score": 8.5,
  "accuracy_feedback": "Nhận xét chi tiết về mức độ truyền tải ý nghĩa, độ chính xác và các lỗi sai (nếu có).",
  "grammar_vocabulary_notes": "Phân tích chi tiết về ngữ pháp, cách dùng từ, trật tự câu hoặc lượng từ cần lưu ý.",
  "standard_translation": "Bản dịch chuẩn sát nghĩa nhất (nếu chiều Việt->Trung thì viết chữ Hán giản thể, nếu Trung->Việt thì viết tiếng Việt chuẩn)",
  "standard_pinyin": "Pinyin có dấu thanh đầy đủ của câu tiếng Trung (nếu chiều Việt->Trung là pinyin bản dịch chuẩn; nếu chiều Trung->Việt là pinyin của đoạn gốc)",
  "alternative_translations": [
    {
      "text": "Cách dịch tự nhiên hơn 1 (khẩu ngữ hoặc mượt mà)",
      "pinyin": "Pinyin tương ứng nếu là tiếng Trung, hoặc chuỗi rỗng nếu tiếng Việt",
      "nuance": "Giải thích ngắn sắc thái của cách dịch này"
    },
    {
      "text": "Cách dịch tự nhiên hơn 2 (trang trọng hoặc gọn gàng hơn)",
      "pinyin": "Pinyin tương ứng nếu là tiếng Trung, hoặc chuỗi rỗng nếu tiếng Việt",
      "nuance": "Giải thích ngắn sắc thái của cách dịch này"
    }
  ],
  "new_vocabulary": [
    {
      "hanzi": "Từ vựng tiếng Trung đáng học trong bài (2-4 từ)",
      "pinyin": "pinyin có dấu thanh",
      "meaning": "nghĩa tiếng Việt ngắn gọn",
      "example_zh": "Câu ví dụ tiếng Trung ngắn gọn đúng trình độ",
      "example_vi": "Dịch nghĩa câu ví dụ sang tiếng Việt"
    }
  ]
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
    console.error('[api/translate-grade]', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Lỗi khi gọi trợ lý chấm dịch AI.',
      code: err.code || 'AI_ERROR',
    });
  }
}
