# Bi & Nhi HSK — Ứng dụng Học & Luyện thi Tiếng Trung HSK 3.0

Không gian học tiếng Trung HSK 3.0 toàn diện, hiện đại, hỗ trợ 2 hồ sơ độc lập (**Bi** và **Nhi**) ngay trên cùng trình duyệt với IndexedDB (`Dexie.js`), sẵn sàng triển khai lên **Vercel**.

## Tính năng chính
- **Hồ sơ riêng biệt Bi & Nhi + Onboarding chọn cấp độ (HSK 1 → HSK 6)**: Tự động lọc toàn bộ nội dung và lưu tiến độ/streak/kỷ lục tách biệt cho từng người.
- **Kho từ vựng 4.605 từ HSK 3.0**: Trích xuất & làm sạch trực tiếp từ 5 tệp `NEW HSK1–5 3.0.pdf` + gói khởi đầu HSK 6, hỗ trợ tìm kiếm Pinyin không dấu, phát âm Web Speech API (`zh-CN`, 0.75x / 1.0x), Import CSV/JSON (Gộp/Ghi đè), tải CSV mẫu và Backup JSON.
- **Flashcard 3D SM-2**: Lật thẻ mượt 60fps, phím tắt bàn phím (`Space`, `S`, `←/→`, `1/2/3`) và vuốt cảm ứng trên điện thoại.
- **3 Trò chơi Từ vựng Arcade**:
  1. *Đua Xe Vượt Cổng Từ Vựng* (HTML5 Canvas 3 làn đường 60fps)
  2. *Nối Từ Siêu Tốc* (12–16 thẻ + bấm giờ)
  3. *Máy Bay Bắn Chữ* (Canvas bắn laser bằng Pinyin không dấu)
- **Phòng Thi HSK 3.0 iBT**: Luyện tập nhanh (10–30 câu) & Thi khảo thí chuẩn 6 cấp độ có đồng hồ đếm ngược tự chuyển phần, giới hạn số lần nghe chuẩn thi thật, phần Viết (HSK 3+), báo cáo điểm chuẩn HSK và Import đề JSON.
- **Trợ lý AI (`gemini-2.5-flash`)**: Luyện dịch song ngữ Trung ↔ Việt (+ lưu từ mới vào IndexedDB), Luyện đặt câu và Hội thoại Roleplay có Micro (`SpeechRecognition`).

## Chạy cục bộ (Local Development)
```bash
npm install
cp .env.example .env
# (Tùy chọn) điền GEMINI_API_KEY vào .env hoặc nhập Personal Gemini API Key trực tiếp ở trang Cài đặt
npm run dev
```

## Triển khai lên Vercel
1. Đẩy mã nguồn lên GitHub và import vào Vercel.
2. Thêm biến môi trường `GEMINI_API_KEY` trong phần **Environment Variables** của dự án Vercel.
3. Nhấn **Deploy** (tự động nhận diện Vite + các Serverless Functions tại `/api/*` theo `vercel.json`).
