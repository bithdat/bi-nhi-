import { getGeminiClient, GEMINI_MODEL, extractJson, setCorsHeaders } from './_gemini.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ai = getGeminiClient(req);
    const {
      scenario = 'Gọi món tại nhà hàng',
      aiRole = 'Nhân viên phục vụ nhà hàng Trung Quốc thân thiện',
      level = 'HSK2',
      history = [],
      userMessage = '',
      isStart = false,
    } = req.body || {};

    const transcript = history
      .slice(-10)
      .map((m) => `${m.role === 'user' ? 'Học viên' : 'AI'}: ${m.zh}`)
      .join('\n');

    const prompt = isStart
      ? `Bạn đang đóng vai: ${aiRole} trong tình huống "${scenario}".
Hãy mở đầu cuộc hội thoại bằng 1–2 câu tiếng Trung giản thể ngắn gọn, tự nhiên, sử dụng từ vựng và cấu trúc phù hợp với trình độ ${level} (chuẩn HSK 3.0).
Trả về CHỈ JSON thuần:
{
  "reply_zh": "Câu mở đầu bằng chữ Hán giản thể",
  "reply_pinyin": "Pinyin có dấu thanh đầy đủ",
  "reply_vi": "Dịch nghĩa tiếng Việt",
  "suggestion_zh": "Gợi ý 1 câu trả lời mẫu cho học viên",
  "suggestion_pinyin": "Pinyin câu gợi ý",
  "suggestion_vi": "Nghĩa tiếng Việt câu gợi ý",
  "feedback": ""
}`
      : `Bạn đang đóng vai: ${aiRole} trong tình huống "${scenario}".
Trình độ mục tiêu của học viên: ${level} (HSK 3.0). Hãy điều chỉnh từ vựng và độ dài câu trả lời phù hợp với ${level} để học viên dễ hiểu và phản xạ tốt.

Lịch sử hội thoại gần nhất:
${transcript}

Học viên vừa nói: """${userMessage}"""

Hãy:
1. Trả lời tiếp mạch hội thoại thật tự nhiên bằng tiếng Trung giản thể (1–3 câu).
2. Góp ý ngắn gọn bằng tiếng Việt về câu nói vừa rồi của học viên (nếu có lỗi ngữ pháp/dùng từ thì sửa nhẹ nhàng; nếu đúng thì khen ngợi).
3. Gợi ý 1 câu đáp lại tiếp theo cho học viên tham khảo.

Trả về CHỈ JSON thuần:
{
  "reply_zh": "Câu trả lời của bạn bằng chữ Hán giản thể",
  "reply_pinyin": "Pinyin có dấu thanh đầy đủ",
  "reply_vi": "Dịch nghĩa tiếng Việt",
  "suggestion_zh": "Gợi ý câu trả lời tiếp theo cho học viên",
  "suggestion_pinyin": "Pinyin câu gợi ý",
  "suggestion_vi": "Nghĩa tiếng Việt câu gợi ý",
  "feedback": "Nhận xét/sửa lỗi ngắn gọn bằng tiếng Việt cho câu vừa nói của học viên"
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
  } catch (err) {
    console.error('[api/roleplay]', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Lỗi khi kết nối trợ lý hội thoại AI.',
      code: err.code || 'AI_ERROR',
    });
  }
}
