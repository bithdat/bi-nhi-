import React from 'react';

export function BrandLogo({ size = 'md', showSubtitle = false }) {
  const dim = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const titleSize =
    size === 'lg' ? 'text-xl sm:text-2xl' : size === 'sm' ? 'text-base' : 'text-[17px]';

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        className={`${dim} relative shrink-0 rounded-xl bg-[#0F766E] flex items-center justify-center border border-[#0F766E]/20`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 44 44" className="w-full h-full" fill="none">
          {/* Inner delicate seal border */}
          <rect
            x="4"
            y="4"
            width="36"
            height="36"
            rx="8"
            stroke="#FAF9F6"
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
          {/* Minimalist calligraphy brush stroke (文 / 人 arch) */}
          <path
            d="M12 14.5C17 12.8 27 12.8 32 14.5"
            stroke="#FDBA74"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeOpacity="0.9"
          />
          <circle cx="22" cy="10.2" r="1.4" fill="#FDBA74" />
          {/* Monogram B&N */}
          <text
            x="22"
            y="28.5"
            textAnchor="middle"
            fill="#FAF9F6"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight="700"
            fontSize="12.5"
            letterSpacing="0.02em"
          >
            B&amp;N
          </text>
          {/* Subtle vermilion seal dot */}
          <rect x="29.5" y="31.5" width="4.5" height="4.5" rx="1" fill="#C2410C" />
        </svg>
      </div>
      <div className="flex flex-col leading-tight">
        <div className="flex items-baseline gap-1.5">
          <span className={`${titleSize} font-bold tracking-tight text-[#1E293B]`}>
            Bi &amp; Nhi
          </span>
          <span className="text-[11px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[#FFF7ED] text-[#C2410C] border border-[#C2410C]/20">
            HSK
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
            Học HSK 3.0 • 学中文
          </span>
        )}
      </div>
    </div>
  );
}
