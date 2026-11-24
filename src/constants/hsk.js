export const PROFILES = {
  bi: {
    id: 'bi',
    name: 'Bi',
    initials: 'Bi',
    hanziMark: '笔',
    tagline: 'Hồ sơ học tập của Bi',
    accentBg: 'bg-[#0F766E]',
    accentSoft: 'bg-[#F0FDFA] text-[#0F766E] border-[#0F766E]/20',
  },
  nhi: {
    id: 'nhi',
    name: 'Nhi',
    initials: 'Nhi',
    hanziMark: '艺',
    tagline: 'Hồ sơ học tập của Nhi',
    accentBg: 'bg-[#C2410C]',
    accentSoft: 'bg-[#FFF7ED] text-[#C2410C] border-[#C2410C]/20',
  },
};

export const HSK_LEVELS = [
  {
    id: 'HSK1',
    short: '1',
    label: 'HSK 1',
    title: 'Nhập môn căn bản',
    officialCount: 500,
    desc: '500 từ vựng thiết yếu — giao tiếp chào hỏi, thời gian, gia đình hàng ngày.',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200/80',
  },
  {
    id: 'HSK2',
    short: '2',
    label: 'HSK 2',
    title: 'Sơ cấp mở rộng',
    officialCount: 772,
    desc: '772 từ mới (lũy kế 1.272) — hội thoại mua sắm, du lịch, công việc cơ bản.',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  },
  {
    id: 'HSK3',
    short: '3',
    label: 'HSK 3',
    title: 'Sơ trung cấp',
    officialCount: 973,
    desc: '973 từ mới (lũy kế 2.245) — trình bày quan điểm, bắt đầu kỹ năng viết câu.',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200/80',
  },
  {
    id: 'HSK4',
    short: '4',
    label: 'HSK 4',
    title: 'Trung cấp ứng dụng',
    officialCount: 1000,
    desc: '1.000 từ mới (lũy kế 3.245) — thảo luận công sở, văn hóa, xã hội tự nhiên.',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  {
    id: 'HSK5',
    short: '5',
    label: 'HSK 5',
    title: 'Trung cao cấp',
    officialCount: 1300,
    desc: '1.300 từ mới trích từ bộ HSK 5 3.0 — đọc báo chí, xem phim, diễn thuyết.',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200/80',
  },
  {
    id: 'HSK6',
    short: '6',
    label: 'HSK 6',
    title: 'Cao cấp học thuật',
    officialCount: 1140,
    desc: 'Chuẩn 1.140 từ cao cấp (tích hợp sẵn 60 từ cốt lõi + hỗ trợ nạp CSV/JSON).',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80',
  },
];

export const LEVEL_MAP = Object.fromEntries(HSK_LEVELS.map((l) => [l.id, l]));

export const TRANSLATION_TOPICS = [
  'Đời sống hàng ngày',
  'Ẩm thực & Nhà hàng',
  'Du lịch & Giao thông',
  'Công việc & Phỏng vấn',
  'Học tập & Campus',
  'Sức khỏe & Thể thao',
  'Công nghệ & Xã hội',
  'Văn hóa Trung Hoa',
];

export const ROLEPLAY_SCENARIOS = [
  {
    id: 'restaurant',
    title: 'Gọi món tại nhà hàng',
    subtitle: '点菜与用餐',
    aiRole: 'Nhân viên phục vụ nhà hàng Trung Hoa thân thiện',
    desc: 'Luyện hỏi món đặc sản, khẩu vị ít cay và thanh toán hóa đơn.',
  },
  {
    id: 'shopping',
    title: 'Mua sắm & Mặc cả',
    subtitle: '购物与讨价还价',
    aiRole: 'Chủ cửa hàng quần áo tại Bắc Kinh nhiệt tình',
    desc: 'Hỏi kích cỡ, màu sắc, thử đồ và thương lượng giá hợp lý.',
  },
  {
    id: 'directions',
    title: 'Hỏi đường & Đi tàu điện',
    subtitle: '问路与乘地铁',
    aiRole: 'Người dân địa phương Thượng Hải nhiệt tình chỉ đường',
    desc: 'Hỏi tuyến tàu điện ngầm, khoảng cách và địa điểm tham quan.',
  },
  {
    id: 'interview',
    title: 'Phỏng vấn xin việc',
    subtitle: '求职面试',
    aiRole: 'Trưởng phòng nhân sự công ty công nghệ chuyên nghiệp',
    desc: 'Giới thiệu bản thân, kinh nghiệm và mục tiêu nghề nghiệp.',
  },
  {
    id: 'hotel',
    title: 'Nhận phòng khách sạn',
    subtitle: '酒店入住',
    aiRole: 'Lễ tân khách sạn 4 sao lịch sự và chu đáo',
    desc: 'Xác nhận đặt phòng, hỏi giờ ăn sáng và dịch vụ phòng.',
  },
  {
    id: 'clinic',
    title: 'Khám bệnh & Mua thuốc',
    subtitle: '看病买药',
    aiRole: 'Bác sĩ phòng khám đa khoa tận tâm',
    desc: 'Mô tả triệu chứng cảm cúm, hỏi cách uống thuốc và nghỉ ngơi.',
  },
];
