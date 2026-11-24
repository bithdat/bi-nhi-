import json
import os
import re
import pymupdf
from pypinyin import pinyin, Style

PDF_DIR = "/tmp/hsk_resources/pdfs"
OUT_PATH = "/tmp/hsk_resources/defaultVocab.json"
REPORT_PATH = "/tmp/hsk_resources/extraction_report.json"

CJK_RE = re.compile(r'[\u4e00-\u9fff]')

def clean_spaces(text: str) -> str:
    if not text:
        return ""
    text = text.replace('\xa0', ' ').replace('\u200b', '')
    return text.strip()

def join_lines_smart(text: str, is_zh: bool = False) -> str:
    if not text:
        return ""
    text = clean_spaces(text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return ""
    if is_zh:
        res = lines[0]
        for ln in lines[1:]:
            if res and CJK_RE.search(res[-1]) and CJK_RE.search(ln[0]):
                res += ln
            else:
                res += " " + ln
        return re.sub(r'\s+', ' ', res).strip()
    else:
        res = lines[0]
        for ln in lines[1:]:
            res += " " + ln
        return re.sub(r'\s+', ' ', res).strip()

def parse_example(raw_ex: str):
    if not raw_ex:
        return "", ""
    raw_ex = raw_ex.replace('\xa0', ' ').replace('\u200b', '').strip()
    lines = [ln.strip() for ln in raw_ex.splitlines() if ln.strip()]
    joined = ""
    for i, ln in enumerate(lines):
        if i == 0:
            joined = ln
        else:
            prev_ch = joined[-1] if joined else ''
            next_ch = ln[0] if ln else ''
            if (CJK_RE.search(prev_ch) or prev_ch in '，。？！、；：“”‘’（）《》') and (CJK_RE.search(next_ch) or next_ch in '，。？！、；：“”‘’（）《》'):
                joined += ln
            else:
                joined += " " + ln
    joined = re.sub(r'\s+', ' ', joined).strip()

    parts = re.split(r'\s*[–—]\s*|\s+-\s+', joined)
    parts = [p.strip() for p in parts if p.strip()]

    example_zh = ""
    example_vi = ""

    if len(parts) >= 3:
        first = parts[0]
        if CJK_RE.search(first):
            example_zh = first
            example_vi = " - ".join(parts[2:])
        else:
            example_zh = parts[0]
            example_vi = parts[-1]
    elif len(parts) == 2:
        left, right = parts[0], parts[1]
        m = list(re.finditer(r'[\u4e00-\u9fff。？！……”’）》]', left))
        if m:
            end_idx = m[-1].end()
            example_zh = left[:end_idx].strip()
        else:
            example_zh = left.strip()
        example_vi = right.strip()
    elif len(parts) == 1:
        text = parts[0]
        m = list(re.finditer(r'[\u4e00-\u9fff。？！……”’）》]', text))
        if m:
            end_idx = m[-1].end()
            example_zh = text[:end_idx].strip()
            rest = text[end_idx:].strip()
            example_vi = rest
        else:
            example_zh = text

    example_zh = example_zh.strip(' –—-')
    example_vi = example_vi.strip(' –—-')
    return example_zh, example_vi

def generate_pinyin(hanzi: str) -> str:
    clean_h = re.sub(r'（[^）]*）|\([^)]*\)', '', hanzi).split('｜')[0].split('|')[0].strip()
    py = pinyin(clean_h, style=Style.TONE)
    return " ".join(x[0] for x in py)

def extract_pdf(level: int):
    pdf_path = os.path.join(PDF_DIR, f"NEW_HSK{level}_3.0.pdf")
    raw_rows = []
    doc = pymupdf.open(pdf_path)
    for page_idx, page in enumerate(doc):
        tf = page.find_tables()
        if not tf or not tf.tables:
            continue
        for table in tf.tables:
            rows = table.extract()
            for row in rows:
                    if not row:
                        continue
                    # Pad/normalize to 6 columns
                    cells = [clean_spaces(c) if c else "" for c in row]
                    # Skip title banners or header rows
                    joined_row = " ".join(cells)
                    if not joined_row:
                        continue
                    if "TỪ VỰNG TIẾNG TRUNG" in joined_row or "CÁC BẠN CẦN TÀI LIỆU" in joined_row or "TIKTOK" in joined_row:
                        continue
                    if cells[0] == "STT" or (len(cells) > 1 and cells[1] == "Tiếng Trung"):
                        continue

                    # Ensure at least 6 cols
                    while len(cells) < 6:
                        cells.append("")

                    stt, hanzi, py, en, vi, ex = cells[:6]

                    # Is this a new entry or continuation of previous row?
                    if stt and re.match(r'^\d+$', stt):
                        raw_rows.append({
                            "stt": int(stt),
                            "hanzi": hanzi,
                            "pinyin": py,
                            "en": en,
                            "vi": vi,
                            "ex": ex,
                            "page": page_idx + 1,
                        })
                    elif not stt and hanzi and CJK_RE.search(hanzi) and py:
                        # Entry missing STT? Treat as new entry
                        raw_rows.append({
                            "stt": len(raw_rows) + 1,
                            "hanzi": hanzi,
                            "pinyin": py,
                            "en": en,
                            "vi": vi,
                            "ex": ex,
                            "page": page_idx + 1,
                        })
                    elif raw_rows:
                        # Continuation row across page break
                        prev = raw_rows[-1]
                        if hanzi:
                            prev["hanzi"] = (prev["hanzi"] + "\n" + hanzi).strip()
                        if py:
                            prev["pinyin"] = (prev["pinyin"] + "\n" + py).strip()
                        if en:
                            prev["en"] = (prev["en"] + "\n" + en).strip()
                        if vi:
                            prev["vi"] = (prev["vi"] + "\n" + vi).strip()
                        if ex:
                            prev["ex"] = (prev["ex"] + "\n" + ex).strip()

    entries = []
    issues = []
    for idx, r in enumerate(raw_rows):
        hanzi = join_lines_smart(r["hanzi"], is_zh=True)
        # Clean stray spaces in hanzi
        hanzi = re.sub(r'\s+', '', hanzi)
        py = join_lines_smart(r["pinyin"], is_zh=False)
        vi = join_lines_smart(r["vi"], is_zh=False)
        en = join_lines_smart(r["en"], is_zh=False)
        ex_zh, ex_vi = parse_example(r["ex"])

        if not py and hanzi:
            py = generate_pinyin(hanzi)
            issues.append(f"HSK{level} #{r['stt']} ({hanzi}): auto-generated pinyin -> {py}")

        if not vi and en:
            vi = en
            issues.append(f"HSK{level} #{r['stt']} ({hanzi}): missing vi, fallback en -> {en}")

        if not hanzi:
            issues.append(f"HSK{level} #{r['stt']}: EMPTY HANZI (skipped)")
            continue

        if not ex_zh or not ex_vi:
            issues.append(f"HSK{level} #{r['stt']} ({hanzi}): incomplete example (zh='{ex_zh[:30]}', vi='{ex_vi[:30]}')")

        entries.append({
            "id": f"hsk{level}-{r['stt']}",
            "level": f"HSK{level}",
            "hanzi": hanzi,
            "pinyin": py,
            "meaning": vi,
            "example_zh": ex_zh,
            "example_vi": ex_vi,
        })

    return entries, issues

def main():
    all_entries = []
    report = {"counts": {}, "issue_counts": {}, "sample_issues": {}, "samples": {}}

    for lvl in range(1, 6):
        print(f"Extracting HSK {lvl}...")
        entries, issues = extract_pdf(lvl)
        all_entries.extend(entries)
        report["counts"][f"HSK{lvl}"] = len(entries)
        report["issue_counts"][f"HSK{lvl}"] = len(issues)
        report["sample_issues"][f"HSK{lvl}"] = issues[:15]
        report["samples"][f"HSK{lvl}"] = entries[:3] + entries[-2:]
        print(f"  -> {len(entries)} entries, {len(issues)} issues")

    report["total"] = len(all_entries)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"TOTAL EXTRACTED: {len(all_entries)}")
    print("Report written to", REPORT_PATH)

if __name__ == "__main__":
    main()
