import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Papa from 'papaparse';
import {
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Gauge,
} from 'lucide-react';
import { db } from '../db/database';
import { useApp } from '../context/AppContext';
import { HSK_LEVELS, LEVEL_MAP } from '../constants/hsk';
import { stripPinyinTones } from '../utils/pinyin';
import { SpeakButton } from '../components/common/SpeakButton';

const PAGE_SIZE = 30;

export function Vocabulary() {
  const { activeProfileId, targetLevels, speechRate, setSpeechRate, showToast } = useApp();

  const [query, setQuery] = useState('');
  const [scopeAllLevels, setScopeAllLevels] = useState(false);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState('merge'); // merge | overwrite
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  // Add single word modal
  const [addOpen, setAddOpen] = useState(false);
  const [newWord, setNewWord] = useState({
    level: targetLevels[0] || 'HSK1',
    hanzi: '',
    pinyin: '',
    meaning: '',
    example_zh: '',
    example_vi: '',
  });

  const data = useLiveQuery(async () => {
    const [allVocab, reviews] = await Promise.all([
      db.vocab.toArray(),
      db.reviews.where('profileId').equals(activeProfileId).toArray(),
    ]);
    const reviewMap = new Map(reviews.map((r) => [r.vocabId, r]));
    return { allVocab, reviewMap };
  }, [activeProfileId]);

  const filteredWords = useMemo(() => {
    if (!data) return [];
    const { allVocab, reviewMap } = data;
    const targetSet = new Set(targetLevels);
    const q = query.trim().toLowerCase();
    const qNoTone = stripPinyinTones(q);

    return allVocab.filter((w) => {
      if (!scopeAllLevels && !targetSet.has(w.level)) return false;
      if (levelFilter !== 'ALL' && w.level !== levelFilter) return false;

      if (statusFilter !== 'ALL') {
        const rev = reviewMap.get(w.id);
        const st = rev ? rev.status : 'new';
        if (st !== statusFilter) return false;
      }

      if (q) {
        const inHanzi = w.hanzi.toLowerCase().includes(q);
        const inPinyin =
          w.pinyin.toLowerCase().includes(q) ||
          stripPinyinTones(w.pinyin).replace(/\s+/g, '').includes(qNoTone.replace(/\s+/g, ''));
        const inMeaning = w.meaning.toLowerCase().includes(q);
        if (!inHanzi && !inPinyin && !inMeaning) return false;
      }

      return true;
    });
  }, [data, targetLevels, scopeAllLevels, levelFilter, statusFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredWords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Download sample CSV with UTF-8 BOM for clean Excel opening
  const handleDownloadSampleCsv = () => {
    const rows = [
      ['level', 'hanzi', 'pinyin', 'meaning', 'example_zh', 'example_vi'],
      ['HSK1', '学习', 'xuéxí', 'học tập', '我每天学习中文。', 'Tôi học tiếng Trung mỗi ngày.'],
      ['HSK2', '准备', 'zhǔnbèi', 'chuẩn bị', '我已经准备好了。', 'Tôi đã chuẩn bị xong rồi.'],
      ['HSK3', '坚持', 'jiānchí', 'kiên trì', '学习语言贵在坚持。', 'Học ngoại ngữ quý ở sự kiên trì.'],
    ];
    const csv = '\uFEFF' + Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bi-nhi-hsk-mau-tu-vung.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải tệp CSV mẫu.');
  };

  // Backup full vocab + current profile progress to JSON
  const handleBackupJson = async () => {
    const [vocab, reviews, gameScores, examHistory, translationLogs, customDecks, customCards] =
      await Promise.all([
        db.vocab.toArray(),
        db.reviews.where('profileId').equals(activeProfileId).toArray(),
        db.gameScores.where('profileId').equals(activeProfileId).toArray(),
        db.examHistory.where('profileId').equals(activeProfileId).toArray(),
        db.translationLogs.where('profileId').equals(activeProfileId).toArray(),
        db.customDecks.where('profileId').equals(activeProfileId).toArray(),
        db.customCards.where('profileId').equals(activeProfileId).toArray(),
      ]);
    const payload = {
      app: 'Bi & Nhi HSK',
      exportedAt: new Date().toISOString(),
      profileId: activeProfileId,
      vocab,
      reviews,
      gameScores,
      examHistory,
      translationLogs,
      customDecks,
      customCards,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bi-nhi-hsk-backup-${activeProfileId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Đã sao lưu ${vocab.length.toLocaleString('vi-VN')} từ vựng và tiến độ.`);
  };

  const normalizeImportedRows = (rawList) => {
    const valid = [];
    const errors = [];
    const validLevels = new Set(['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6']);

    rawList.forEach((row, idx) => {
      const hanzi = String(row.hanzi || row['Tiếng Trung'] || '').trim();
      const pinyin = String(row.pinyin || row['Pinyin'] || '').trim();
      const meaning = String(row.meaning || row['Tiếng Việt'] || '').trim();
      let level = String(row.level || row['Cấp độ'] || targetLevels[0] || 'HSK1')
        .toUpperCase()
        .replace(/\s+/g, '');
      if (/^[1-6]$/.test(level)) level = `HSK${level}`;
      if (!validLevels.has(level)) level = 'HSK1';

      if (!hanzi || !meaning) {
        errors.push(`Dòng ${idx + 1}: Thiếu chữ Hán (hanzi) hoặc nghĩa (meaning).`);
        return;
      }

      valid.push({
        id: row.id || `custom-${level.toLowerCase()}-${Date.now()}-${idx}`,
        level,
        hanzi,
        pinyin: pinyin || '(chưa có pinyin)',
        meaning,
        example_zh: String(row.example_zh || '').trim(),
        example_vi: String(row.example_vi || '').trim(),
        createdAt: Date.now(),
      });
    });

    return { valid, errors };
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportPreview(null);

    if (file.name.toLowerCase().endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.vocab) ? parsed.vocab : null;
          if (!arr) {
            setImportError('Tệp JSON phải là mảng từ vựng hoặc bản sao lưu hợp lệ có trường "vocab".');
            return;
          }
          const result = normalizeImportedRows(arr);
          setImportPreview({ filename: file.name, ...result });
        } catch {
          setImportError('Không thể phân tích cú pháp tệp JSON. Vui lòng kiểm tra lại định dạng.');
        }
      };
      reader.readAsText(file, 'utf-8');
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          if (!res.data || res.data.length === 0) {
            setImportError('Tệp CSV rỗng hoặc không đọc được tiêu đề cột.');
            return;
          }
          const result = normalizeImportedRows(res.data);
          setImportPreview({ filename: file.name, ...result });
        },
        error: () => {
          setImportError('Lỗi khi đọc tệp CSV.');
        },
      });
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.valid.length === 0) return;
    await db.transaction('rw', db.vocab, async () => {
      if (importMode === 'overwrite') {
        await db.vocab.clear();
      }
      await db.vocab.bulkPut(importPreview.valid);
    });
    showToast(
      `Đã ${importMode === 'overwrite' ? 'ghi đè' : 'gộp thêm'} ${importPreview.valid.length.toLocaleString('vi-VN')} từ vựng!`
    );
    setImportOpen(false);
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSingleWord = async (e) => {
    e.preventDefault();
    if (!newWord.hanzi.trim() || !newWord.meaning.trim()) {
      showToast('Vui lòng nhập ít nhất Chữ Hán và Nghĩa tiếng Việt.', 'warning');
      return;
    }
    await db.vocab.put({
      id: `user-${Date.now()}`,
      level: newWord.level,
      hanzi: newWord.hanzi.trim(),
      pinyin: newWord.pinyin.trim() || '—',
      meaning: newWord.meaning.trim(),
      example_zh: newWord.example_zh.trim(),
      example_vi: newWord.example_vi.trim(),
      createdAt: Date.now(),
    });
    showToast(`Đã thêm từ "${newWord.hanzi.trim()}" vào kho ${newWord.level}.`);
    setNewWord({
      level: targetLevels[0] || 'HSK1',
      hanzi: '',
      pinyin: '',
      meaning: '',
      example_zh: '',
      example_vi: '',
    });
    setAddOpen(false);
  };

  const availableLevelTabs = scopeAllLevels
    ? HSK_LEVELS
    : HSK_LEVELS.filter((l) => targetLevels.includes(l.id));

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
            Kho từ vựng HSK 3.0
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B] mt-1">
            Từ điển chuẩn hóa ({data ? data.allVocab.length.toLocaleString('vi-VN') : '...'} từ)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Đang hiển thị <strong className="text-[#1E293B]">{filteredWords.length.toLocaleString('vi-VN')}</strong> từ{' '}
            {scopeAllLevels ? 'trên toàn bộ 6 cấp độ' : `thuộc mục tiêu ${targetLevels.join(', ')}`}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm từ</span>
          </button>
          <button
            id="vocab-import-btn"
            type="button"
            onClick={() => setImportOpen(true)}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-[#0F766E]/40 text-xs sm:text-sm font-semibold text-[#1E293B] cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#0F766E]" />
            <span>Import CSV/JSON</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 text-xs sm:text-sm font-medium text-slate-600 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">CSV mẫu</span>
          </button>
          <button
            type="button"
            onClick={handleBackupJson}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 text-xs sm:text-sm font-medium text-slate-600 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Backup JSON</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="vocab-search-input"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo chữ Hán, Pinyin (có/không dấu) hoặc nghĩa tiếng Việt..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#FAF9F6] border border-slate-200/90 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSpeechRate(speechRate === 1.0 ? 0.75 : 1.0)}
              className="btn-tactile inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/90 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <Gauge className="w-4 h-4 text-[#0F766E]" />
              <span>Đọc {speechRate}x</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScopeAllLevels((v) => !v);
                setLevelFilter('ALL');
                setPage(1);
              }}
              className={`btn-tactile min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                scopeAllLevels
                  ? 'bg-[#FFF7ED] border-[#C2410C]/30 text-[#C2410C]'
                  : 'bg-[#FAF9F6] border-slate-200/90 text-slate-600'
              }`}
            >
              {scopeAllLevels ? 'Đang xem: Tất cả 6 cấp' : 'Chỉ xem mục tiêu'}
            </button>
          </div>
        </div>

        {/* Level & Status Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setLevelFilter('ALL');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                levelFilter === 'ALL'
                  ? 'bg-[#0F766E] text-white'
                  : 'bg-[#FAF9F6] text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả
            </button>
            {availableLevelTabs.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => {
                  setLevelFilter(lvl.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  levelFilter === lvl.id
                    ? 'bg-[#0F766E] text-white'
                    : 'bg-[#FAF9F6] text-slate-600 hover:bg-slate-100'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: 'Mọi trạng thái' },
              { id: 'new', label: 'Chưa học' },
              { id: 'learning', label: 'Đang ôn' },
              { id: 'mastered', label: 'Đã thuộc' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStatusFilter(st.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                  statusFilter === st.id
                    ? 'bg-white border-[#0F766E]/50 text-[#0F766E]'
                    : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vocab Grid */}
      {pageItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <p className="text-base font-semibold text-[#1E293B]">Không tìm thấy từ vựng phù hợp</p>
          <p className="text-sm text-slate-500 mt-1">
            Thử đổi từ khóa tìm kiếm hoặc bật chế độ xem tất cả 6 cấp độ HSK.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {pageItems.map((word) => {
            const rev = data?.reviewMap.get(word.id);
            const lvlMeta = LEVEL_MAP[word.level];
            return (
              <article
                key={word.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-hanzi-serif text-2xl sm:text-[28px] font-semibold text-[#1E293B] leading-tight">
                          {word.hanzi}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            lvlMeta?.badgeClass || 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {word.level}
                        </span>
                        {rev?.status === 'mastered' && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F0FDFA] text-[#0F766E] border border-[#0F766E]/20">
                            Đã thuộc
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[#0F766E] mt-1">{word.pinyin}</p>
                      <p className="text-sm text-[#1E293B] font-medium mt-1">{word.meaning}</p>
                    </div>
                    <SpeakButton text={word.hanzi} size="icon" />
                  </div>

                  {word.example_zh && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-start justify-between gap-2.5">
                      <div className="text-xs leading-relaxed space-y-0.5 min-w-0">
                        <p className="font-hanzi text-sm text-[#1E293B]">{word.example_zh}</p>
                        {word.example_vi && <p className="text-slate-500">{word.example_vi}</p>}
                      </div>
                      <SpeakButton text={word.example_zh} size="sm" />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/80 px-4 py-3">
          <span className="text-xs text-slate-500">
            Trang <strong className="text-[#1E293B]">{safePage}</strong> / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-tactile inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn-tactile inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <span>Sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Import CSV/JSON Modal */}
      {importOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="animate-modal-in bg-white rounded-2xl border border-slate-200/90 max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1E293B]">Import Từ vựng (CSV / JSON)</h3>
                <button
                  type="button"
                  onClick={() => {
                    setImportOpen(false);
                    setImportPreview(null);
                    setImportError('');
                  }}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Hỗ trợ tệp CSV có các cột <code className="px-1 py-0.5 rounded bg-slate-100">level, hanzi, pinyin, meaning, example_zh, example_vi</code> hoặc tệp Backup JSON.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="block w-full text-xs text-slate-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#F0FDFA] file:text-[#0F766E] hover:file:bg-teal-100 cursor-pointer"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${
                    importMode === 'merge'
                      ? 'bg-[#F0FDFA] border-[#0F766E]/50 text-[#0F766E]'
                      : 'bg-[#FAF9F6] border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="font-bold">Gộp thêm (Merge)</div>
                  <div className="opacity-80 mt-0.5">Giữ nguyên kho từ hiện tại</div>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('overwrite')}
                  className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${
                    importMode === 'overwrite'
                      ? 'bg-[#FFF7ED] border-[#C2410C]/50 text-[#C2410C]'
                      : 'bg-[#FAF9F6] border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="font-bold">Ghi đè (Overwrite)</div>
                  <div className="opacity-80 mt-0.5">Thay thế toàn bộ kho từ</div>
                </button>
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importPreview && (
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/80 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-[#0F766E]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {importPreview.filename}: {importPreview.valid.length} từ hợp lệ
                    </span>
                  </div>
                  {importPreview.errors.length > 0 && (
                    <p className="text-amber-700">
                      Bỏ qua {importPreview.errors.length} dòng lỗi ({importPreview.errors[0]})
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!importPreview || importPreview.valid.length === 0}
                  onClick={handleConfirmImport}
                  className="btn-tactile min-h-[42px] px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                >
                  Xác nhận Import
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Add Single Word Modal */}
      {addOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleAddSingleWord}
              className="animate-modal-in bg-white rounded-2xl border border-slate-200/90 max-w-md w-full p-6 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1E293B]">Thêm từ vựng mới</h3>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Cấp độ</label>
                  <select
                    value={newWord.level}
                    onChange={(e) => setNewWord((w) => ({ ...w, level: e.target.value }))}
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
                  >
                    {HSK_LEVELS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Chữ Hán *</label>
                  <input
                    required
                    value={newWord.hanzi}
                    onChange={(e) => setNewWord((w) => ({ ...w, hanzi: e.target.value }))}
                    placeholder="你好"
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm font-hanzi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Pinyin</label>
                  <input
                    value={newWord.pinyin}
                    onChange={(e) => setNewWord((w) => ({ ...w, pinyin: e.target.value }))}
                    placeholder="nǐ hǎo"
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Nghĩa tiếng Việt *</label>
                  <input
                    required
                    value={newWord.meaning}
                    onChange={(e) => setNewWord((w) => ({ ...w, meaning: e.target.value }))}
                    placeholder="xin chào"
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Câu ví dụ (Tiếng Trung)</label>
                <input
                  value={newWord.example_zh}
                  onChange={(e) => setNewWord((w) => ({ ...w, example_zh: e.target.value }))}
                  placeholder="你好，很高兴认识你。"
                  className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm font-hanzi"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Dịch nghĩa ví dụ</label>
                <input
                  value={newWord.example_vi}
                  onChange={(e) => setNewWord((w) => ({ ...w, example_vi: e.target.value }))}
                  placeholder="Xin chào, rất vui được làm quen với bạn."
                  className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-tactile min-h-[42px] px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold cursor-pointer"
                >
                  Lưu từ vựng
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
}
