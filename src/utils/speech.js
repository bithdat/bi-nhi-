import { cleanHanziForSpeech } from './pinyin';

let cachedZhVoice = null;

function pickChineseVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return cachedZhVoice;

  const preferred =
    voices.find((v) => v.lang === 'zh-CN' && /google|xiaoxiao|yunxi|ting-ting|tingting/i.test(v.name)) ||
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang?.toLowerCase().startsWith('zh'));

  cachedZhVoice = preferred || null;
  return cachedZhVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    pickChineseVoice();
  };
}

export function speakChinese(text, rate = 1.0, onEnd) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return false;
  }
  const clean = cleanHanziForSpeech(text);
  if (!clean) {
    if (onEnd) onEnd();
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'zh-CN';
    utter.rate = Math.min(1.5, Math.max(0.5, Number(rate) || 1.0));
    const voice = pickChineseVoice();
    if (voice) utter.voice = voice;
    if (onEnd) {
      utter.onend = onEnd;
      utter.onerror = onEnd;
    }
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    if (onEnd) onEnd();
    return false;
  }
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startChineseRecognition({ onResult, onEnd, onError }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.('Trình duyệt hiện tại không hỗ trợ nhận diện giọng nói.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const isFinal = event.results[event.results.length - 1]?.isFinal;
    onResult?.(transcript, Boolean(isFinal));
  };

  recognition.onerror = (event) => {
    const msg =
      event.error === 'not-allowed'
        ? 'Vui lòng cấp quyền truy cập Micro cho trình duyệt.'
        : event.error === 'no-speech'
        ? 'Không nghe thấy giọng nói, hãy thử lại nhé.'
        : `Lỗi micro: ${event.error}`;
    onError?.(msg);
  };

  recognition.onend = () => {
    onEnd?.();
  };

  recognition.start();
  return recognition;
}
