const TONE_MAP = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
  ń: 'n', ň: 'n', ǹ: 'n',
  ḿ: 'm',
};

export function stripPinyinTones(str = '') {
  return String(str)
    .toLowerCase()
    .split('')
    .map((ch) => TONE_MAP[ch] ?? ch)
    .join('');
}

/**
 * Normalize pinyin for flexible matching in search & Space Typing Shooter.
 * Accepts variants separated by | or ｜, ignores spaces/apostrophes/punctuation,
 * and treats v and u equivalently for ü.
 */
export function getAcceptedPinyinForms(rawPinyin = '') {
  const segments = String(rawPinyin)
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .split(/[｜|/]/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const forms = new Set();
  for (const seg of segments) {
    const base = stripPinyinTones(seg).replace(/[^a-z]/g, '');
    if (!base) continue;
    forms.add(base);
    if (base.includes('v')) {
      forms.add(base.replace(/v/g, 'u'));
    }
  }
  return Array.from(forms);
}

export function matchPinyinInput(input, rawPinyin) {
  const cleaned = stripPinyinTones(input).replace(/[^a-z]/g, '');
  if (!cleaned) return false;
  const accepted = getAcceptedPinyinForms(rawPinyin);
  return accepted.includes(cleaned);
}

/**
 * Clean Hanzi for speech synthesis & display highlights
 * e.g. "爸爸｜爸" -> "爸爸", "白（形）" -> "白"
 */
export function cleanHanziForSpeech(hanzi = '') {
  return String(hanzi)
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .split(/[｜|/]/)[0]
    .trim();
}
