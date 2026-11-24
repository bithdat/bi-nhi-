import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { speakChinese } from '../../utils/speech';
import { useApp } from '../../context/AppContext';

export function SpeakButton({
  text,
  rate,
  label,
  size = 'md',
  variant = 'subtle',
  className = '',
  onClickExtra,
}) {
  const { speechRate } = useApp();
  const [speaking, setSpeaking] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    setSpeaking(true);
    speakChinese(text, rate ?? speechRate, () => setSpeaking(false));
    onClickExtra?.();
  };

  const sizeClass =
    size === 'sm'
      ? 'h-9 px-2.5 text-xs gap-1.5'
      : size === 'icon'
      ? 'w-11 h-11 p-0 justify-center'
      : 'min-h-[44px] px-3.5 text-sm gap-2';

  const variantClass =
    variant === 'primary'
      ? 'bg-[#0F766E] text-white hover:bg-[#115E59] border border-[#0F766E]'
      : 'bg-white text-slate-700 hover:text-[#0F766E] hover:border-[#0F766E]/40 hover:bg-[#F0FDFA] border border-slate-200/80';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label || `Phát âm ${text}`}
      title="Nghe phát âm tiếng Trung (zh-CN)"
      className={`btn-tactile inline-flex items-center rounded-xl font-medium cursor-pointer ${sizeClass} ${variantClass} ${
        speaking ? 'ring-2 ring-[#0F766E]/30 text-[#0F766E]' : ''
      } ${className}`}
    >
      <Volume2 className={`w-4 h-4 shrink-0 ${speaking ? 'animate-pulse' : ''}`} />
      {label && <span>{label}</span>}
    </button>
  );
}
