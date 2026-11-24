import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  FolderPlus,
  Play,
  Pencil,
  Trash2,
  X,
  Search,
  Sparkles,
  FileText,
  Layers,
} from 'lucide-react';
import { db } from '../../db/database';
import { useApp } from '../../context/AppContext';
import { SpeakButton } from '../common/SpeakButton';

export function CustomFlashcardsManager({ onStartStudy }) {
  const { activeProfileId, activeProfile, showToast } = useApp();

  const [selectedDeckId, setSelectedDeckId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create/Edit single card modal
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formTab, setFormTab] = useState('single'); // 'single' | 'bulk'
  const [cardForm, setCardForm] = useState({
    deckId: 'default',
    hanzi: '',
    pinyin: '',
    meaning: '',
    example_zh: '',
    example_vi: '',
  });
  const [bulkText, setBulkText] = useState('');

  // Create new deck inline
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  const data = useLiveQuery(async () => {
    const [decks, cards, reviews] = await Promise.all([
      db.customDecks.where('profileId').equals(activeProfileId).sortBy('createdAt'),
      db.customCards.where('profileId').equals(activeProfileId).reverse().sortBy('createdAt'),
      db.reviews.where('profileId').equals(activeProfileId).toArray(),
    ]);
    const reviewMap = new Map(reviews.map((r) => [r.vocabId, r]));
    return { decks, cards, reviewMap };
  }, [activeProfileId]);

  const decks = data?.decks || [];
  const cards = data?.cards || [];
  const reviewMap = data?.reviewMap || new Map();

  const deckNameMap = useMemo(() => {
    const map = new Map([['default', 'Bộ thẻ chung']]);
    decks.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [decks]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards.filter((c) => {
      if (selectedDeckId !== 'ALL' && (c.deckId || 'default') !== selectedDeckId) return false;
      if (q) {
        const hit =
          c.hanzi.toLowerCase().includes(q) ||
          (c.pinyin || '').toLowerCase().includes(q) ||
          c.meaning.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [cards, selectedDeckId, searchQuery]);

  const openCreateModal = () => {
    setEditingCard(null);
    setFormTab('single');
    setCardForm({
      deckId: selectedDeckId === 'ALL' ? 'default' : selectedDeckId,
      hanzi: '',
      pinyin: '',
      meaning: '',
      example_zh: '',
      example_vi: '',
    });
    setBulkText('');
    setCardModalOpen(true);
  };

  const openEditModal = (card) => {
    setEditingCard(card);
    setFormTab('single');
    setCardForm({
      deckId: card.deckId || 'default',
      hanzi: card.hanzi || '',
      pinyin: card.pinyin || '',
      meaning: card.meaning || '',
      example_zh: card.example_zh || '',
      example_vi: card.example_vi || '',
    });
    setCardModalOpen(true);
  };

  const handleSaveSingleCard = async (e) => {
    e.preventDefault();
    if (!cardForm.hanzi.trim() || !cardForm.meaning.trim()) {
      showToast('Vui lòng nhập Mặt trước (Chữ Hán/Từ) và Mặt sau (Nghĩa).', 'warning');
      return;
    }

    const deckLabel = deckNameMap.get(cardForm.deckId) || 'Bộ thẻ chung';
    const record = {
      id: editingCard ? editingCard.id : `ccard-${activeProfileId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profileId: activeProfileId,
      deckId: cardForm.deckId || 'default',
      level: deckLabel,
      hanzi: cardForm.hanzi.trim(),
      pinyin: cardForm.pinyin.trim(),
      meaning: cardForm.meaning.trim(),
      example_zh: cardForm.example_zh.trim(),
      example_vi: cardForm.example_vi.trim(),
      createdAt: editingCard ? editingCard.createdAt : Date.now(),
    };

    await db.customCards.put(record);
    showToast(editingCard ? 'Đã cập nhật thẻ Flashcard!' : `Đã thêm thẻ "${record.hanzi}" vào bộ thẻ riêng!`);
    setCardModalOpen(false);
    setEditingCard(null);
  };

  const handleSaveBulkCards = async (e) => {
    e.preventDefault();
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      showToast('Vui lòng nhập ít nhất 1 dòng theo mẫu: Chữ Hán | Pinyin | Nghĩa.', 'warning');
      return;
    }

    const deckId = cardForm.deckId || 'default';
    const deckLabel = deckNameMap.get(deckId) || 'Bộ thẻ chung';
    const now = Date.now();
    const toAdd = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/[|｜\t]/).map((s) => s.trim());
      if (parts.length >= 3) {
        toAdd.push({
          id: `ccard-${activeProfileId}-${now}-${idx}`,
          profileId: activeProfileId,
          deckId,
          level: deckLabel,
          hanzi: parts[0],
          pinyin: parts[1],
          meaning: parts[2],
          example_zh: parts[3] || '',
          example_vi: parts[4] || '',
          createdAt: now + idx,
        });
      } else if (parts.length === 2) {
        toAdd.push({
          id: `ccard-${activeProfileId}-${now}-${idx}`,
          profileId: activeProfileId,
          deckId,
          level: deckLabel,
          hanzi: parts[0],
          pinyin: '',
          meaning: parts[1],
          example_zh: '',
          example_vi: '',
          createdAt: now + idx,
        });
      }
    });

    if (toAdd.length === 0) {
      showToast('Không nhận diện được thẻ hợp lệ. Dùng dấu "|" ngăn cách (vd: 你好 | nǐ hǎo | xin chào).', 'warning');
      return;
    }

    await db.customCards.bulkPut(toAdd);
    showToast(`Đã tạo nhanh ${toAdd.length} thẻ Flashcard riêng!`);
    setCardModalOpen(false);
    setBulkText('');
  };

  const handleDeleteCard = async (card) => {
    await db.customCards.delete(card.id);
    showToast(`Đã xóa thẻ "${card.hanzi}".`, 'info');
  };

  const handleCreateDeck = async (e) => {
    e.preventDefault();
    const name = newDeckName.trim();
    if (!name) return;
    const deck = {
      id: `deck-${activeProfileId}-${Date.now()}`,
      profileId: activeProfileId,
      name,
      createdAt: Date.now(),
    };
    await db.customDecks.put(deck);
    setNewDeckName('');
    setNewDeckOpen(false);
    setSelectedDeckId(deck.id);
    showToast(`Đã tạo bộ thẻ "${name}" cho ${activeProfile.name}.`);
  };

  const handleDeleteDeck = async (deck) => {
    const countInDeck = cards.filter((c) => c.deckId === deck.id).length;
    const ok = window.confirm(
      countInDeck > 0
        ? `Xóa bộ thẻ "${deck.name}" và ${countInDeck} thẻ bên trong?`
        : `Xóa bộ thẻ "${deck.name}"?`
    );
    if (!ok) return;
    await db.transaction('rw', db.customDecks, db.customCards, async () => {
      await db.customDecks.delete(deck.id);
      const ids = cards.filter((c) => c.deckId === deck.id).map((c) => c.id);
      if (ids.length) await db.customCards.bulkDelete(ids);
    });
    if (selectedDeckId === deck.id) setSelectedDeckId('ALL');
    showToast(`Đã xóa bộ thẻ "${deck.name}".`, 'info');
  };

  const activeDeckCards = useMemo(() => {
    if (selectedDeckId === 'ALL') return cards;
    return cards.filter((c) => (c.deckId || 'default') === selectedDeckId);
  }, [cards, selectedDeckId]);

  return (
    <div className="space-y-5">
      {/* Top Action Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
            Bộ thẻ cá nhân của {activeProfile.name}
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            Hiện có <strong className="text-[#1E293B]">{cards.length}</strong> thẻ tự tạo trong{' '}
            <strong className="text-[#1E293B]">{decks.length + 1}</strong> bộ thẻ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="custom-fc-new-deck-btn"
            type="button"
            onClick={() => setNewDeckOpen((v) => !v)}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#0F766E]" />
            <span>Bộ thẻ mới</span>
          </button>

          <button
            id="custom-fc-create-btn"
            type="button"
            onClick={openCreateModal}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo thẻ mới</span>
          </button>

          {activeDeckCards.length > 0 && (
            <button
              id="custom-fc-study-btn"
              type="button"
              onClick={() =>
                onStartStudy(
                  activeDeckCards,
                  selectedDeckId === 'ALL'
                    ? `Tất cả thẻ tự tạo (${activeProfile.name})`
                    : deckNameMap.get(selectedDeckId) || 'Bộ thẻ riêng'
                )
              }
              className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Học {activeDeckCards.length} thẻ (3D SM-2)</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline New Deck Form */}
      {newDeckOpen && (
        <form
          onSubmit={handleCreateDeck}
          className="animate-modal-in bg-[#F0FDFA] rounded-2xl border border-[#0F766E]/25 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <input
            id="custom-deck-name-input"
            type="text"
            autoFocus
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="Nhập tên bộ thẻ mới (vd: Từ hay nhầm, Du lịch Thượng Hải...)"
            className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200 focus:border-[#0F766E] focus:outline-none text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              id="custom-deck-save-btn"
              type="submit"
              className="btn-tactile min-h-[42px] px-4 rounded-xl bg-[#0F766E] text-white text-xs font-semibold cursor-pointer"
            >
              Lưu bộ thẻ
            </button>
            <button
              type="button"
              onClick={() => setNewDeckOpen(false)}
              className="min-h-[42px] px-3 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Deck Pills + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedDeckId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              selectedDeckId === 'ALL'
                ? 'bg-[#0F766E] text-white'
                : 'bg-white border border-slate-200/80 text-slate-600 hover:border-slate-300'
            }`}
          >
            Tất cả ({cards.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedDeckId('default')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              selectedDeckId === 'default'
                ? 'bg-[#0F766E] text-white'
                : 'bg-white border border-slate-200/80 text-slate-600 hover:border-slate-300'
            }`}
          >
            Bộ thẻ chung ({cards.filter((c) => (c.deckId || 'default') === 'default').length})
          </button>

          {decks.map((d) => {
            const count = cards.filter((c) => c.deckId === d.id).length;
            const active = selectedDeckId === d.id;
            return (
              <div key={d.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedDeckId(d.id)}
                  className={`px-3 py-1.5 rounded-l-xl text-xs font-semibold cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#0F766E] text-white'
                      : 'bg-white border border-r-0 border-slate-200/80 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {d.name} ({count})
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDeck(d)}
                  title={`Xóa bộ thẻ ${d.name}`}
                  className={`px-2 py-1.5 rounded-r-xl text-xs cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#115E59] text-teal-100 hover:text-white'
                      : 'bg-white border border-slate-200/80 text-slate-400 hover:text-red-600'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {cards.length > 0 && (
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm thẻ tự tạo..."
              className="w-full min-h-[38px] pl-9 pr-3 rounded-xl bg-white border border-slate-200/90 focus:border-[#0F766E] focus:outline-none text-xs"
            />
          </div>
        )}
      </div>

      {/* Cards List or Empty State */}
      {filteredCards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F0FDFA] text-[#0F766E] mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#1E293B]">
            {cards.length === 0
              ? `Chưa có thẻ Flashcard riêng nào cho ${activeProfile.name}`
              : 'Không có thẻ nào khớp bộ lọc hiện tại'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Tự tạo bộ thẻ ghi chú từ vựng chuyên ngành, câu khẩu ngữ hay dùng hoặc các từ khó nhớ — luyện lật thẻ 3D SM-2 mượt mà giống hệt bộ HSK 3.0!
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-tactile inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo thẻ đầu tiên ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCards.map((card) => {
            const rev = reviewMap.get(card.id);
            const deckName = deckNameMap.get(card.deckId || 'default') || 'Bộ thẻ chung';
            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-hanzi-serif text-2xl font-semibold text-[#1E293B]">
                        {card.hanzi}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-slate-200/80 text-slate-500">
                        {deckName}
                      </span>
                      {rev?.status === 'mastered' && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F0FDFA] text-[#0F766E] border border-[#0F766E]/20">
                          Đã thuộc
                        </span>
                      )}
                    </div>
                    {card.pinyin && (
                      <p className="text-xs font-medium text-[#0F766E] mt-1">{card.pinyin}</p>
                    )}
                    <p className="text-sm font-semibold text-[#1E293B] mt-1">{card.meaning}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <SpeakButton text={card.hanzi} size="sm" />
                    <button
                      type="button"
                      onClick={() => openEditModal(card)}
                      aria-label="Sửa thẻ"
                      className="btn-tactile w-9 h-9 rounded-xl border border-slate-200/80 hover:border-[#0F766E]/40 hover:text-[#0F766E] text-slate-500 flex items-center justify-center cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card)}
                      aria-label="Xóa thẻ"
                      className="btn-tactile w-9 h-9 rounded-xl border border-slate-200/80 hover:border-red-300 hover:text-red-600 text-slate-400 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {card.example_zh && (
                  <div className="pt-2.5 border-t border-slate-100 text-xs space-y-0.5">
                    <p className="font-hanzi text-slate-700">{card.example_zh}</p>
                    {card.example_vi && <p className="text-slate-400">{card.example_vi}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit / Bulk Modal */}
      {cardModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="animate-modal-in bg-white rounded-2xl border border-slate-200/90 max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1E293B]">
                  {editingCard ? 'Chỉnh sửa thẻ Flashcard' : 'Tạo thẻ Flashcard riêng'}
                </h3>
                <button
                  type="button"
                  onClick={() => setCardModalOpen(false)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Single vs Bulk toggle (only when creating new) */}
              {!editingCard && (
                <div className="grid grid-cols-2 gap-1.5 bg-[#FAF9F6] p-1 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setFormTab('single')}
                    className={`min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      formTab === 'single' ? 'bg-[#0F766E] text-white' : 'text-slate-600'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tạo từng thẻ</span>
                  </button>
                  <button
                    id="custom-fc-bulk-tab"
                    type="button"
                    onClick={() => setFormTab('bulk')}
                    className={`min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      formTab === 'bulk' ? 'bg-[#0F766E] text-white' : 'text-slate-600'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Nhập nhanh nhiều thẻ</span>
                  </button>
                </div>
              )}

              {/* Deck selector */}
              <div>
                <label className="text-xs font-semibold text-slate-600">Lưu vào bộ thẻ</label>
                <select
                  value={cardForm.deckId}
                  onChange={(e) => setCardForm((f) => ({ ...f, deckId: e.target.value }))}
                  className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
                >
                  <option value="default">Bộ thẻ chung</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {formTab === 'single' ? (
                <form onSubmit={handleSaveSingleCard} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Mặt trước (Chữ Hán / Từ khóa) *
                      </label>
                      <input
                        id="custom-card-hanzi-input"
                        required
                        value={cardForm.hanzi}
                        onChange={(e) => setCardForm((f) => ({ ...f, hanzi: e.target.value }))}
                        placeholder="vd: 坚持"
                        className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 focus:border-[#0F766E] focus:bg-white focus:outline-none text-base font-hanzi"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Pinyin (tùy chọn)</label>
                      <input
                        id="custom-card-pinyin-input"
                        value={cardForm.pinyin}
                        onChange={(e) => setCardForm((f) => ({ ...f, pinyin: e.target.value }))}
                        placeholder="vd: jiānchí"
                        className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Mặt sau (Nghĩa tiếng Việt / Ghi chú) *
                    </label>
                    <input
                      id="custom-card-meaning-input"
                      required
                      value={cardForm.meaning}
                      onChange={(e) => setCardForm((f) => ({ ...f, meaning: e.target.value }))}
                      placeholder="vd: kiên trì, bền bỉ"
                      className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Câu ví dụ tiếng Trung (tùy chọn)
                    </label>
                    <input
                      value={cardForm.example_zh}
                      onChange={(e) => setCardForm((f) => ({ ...f, example_zh: e.target.value }))}
                      placeholder="vd: 我们一起坚持学中文吧！"
                      className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm font-hanzi"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Dịch nghĩa ví dụ (tùy chọn)
                    </label>
                    <input
                      value={cardForm.example_vi}
                      onChange={(e) => setCardForm((f) => ({ ...f, example_vi: e.target.value }))}
                      placeholder="vd: Chúng mình cùng kiên trì học tiếng Trung nhé!"
                      className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCardModalOpen(false)}
                      className="min-h-[42px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      id="custom-card-submit-btn"
                      type="submit"
                      className="btn-tactile min-h-[42px] px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold cursor-pointer"
                    >
                      {editingCard ? 'Lưu thay đổi' : 'Tạo thẻ Flashcard'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSaveBulkCards} className="space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Mỗi dòng 1 thẻ theo cú pháp{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#1E293B]">
                      Chữ Hán | Pinyin | Nghĩa tiếng Việt
                    </code>{' '}
                    (có thể thêm <code className="px-1 py-0.5 rounded bg-slate-100">| Ví dụ ZH | Ví dụ VI</code>).
                  </p>
                  <textarea
                    id="custom-card-bulk-textarea"
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`加油 | jiāyóu | cố lên!\n没关系 | méi guānxi | không sao đâu\n辛苦了 | xīnkǔ le | vất vả rồi`}
                    className="w-full p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm font-hanzi"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCardModalOpen(false)}
                      className="min-h-[42px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      id="custom-card-bulk-submit-btn"
                      type="submit"
                      className="btn-tactile min-h-[42px] px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold cursor-pointer"
                    >
                      Tạo hàng loạt
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
