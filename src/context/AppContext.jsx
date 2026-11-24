import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ensureSeeded } from '../db/seed';
import { PROFILES } from '../constants/hsk';

const AppContext = createContext(null);

const ACTIVE_PROFILE_KEY = 'binhi_active_profile';
const SPEECH_RATE_KEY = 'binhi_speech_rate';
const PERSONAL_API_KEY_STORAGE = 'binhi_personal_gemini_key';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr() {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultProfileState() {
  return {
    onboarded: false,
    targetLevels: ['HSK1', 'HSK2'],
    streak: 0,
    bestStreak: 0,
    lastStudyDate: null,
  };
}

function loadProfileState(profileId) {
  try {
    const raw = localStorage.getItem(`binhi_profile_${profileId}`);
    if (!raw) return defaultProfileState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultProfileState(),
      ...parsed,
      targetLevels:
        Array.isArray(parsed.targetLevels) && parsed.targetLevels.length > 0
          ? parsed.targetLevels
          : ['HSK1'],
    };
  } catch {
    return defaultProfileState();
  }
}

export function AppProvider({ children }) {
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return saved === 'nhi' ? 'nhi' : 'bi';
  });

  const [profileStates, setProfileStates] = useState(() => ({
    bi: loadProfileState('bi'),
    nhi: loadProfileState('nhi'),
  }));

  const [speechRate, setSpeechRateState] = useState(() => {
    const saved = Number(localStorage.getItem(SPEECH_RATE_KEY));
    return saved === 0.75 ? 0.75 : 1.0;
  });

  const [personalApiKey, setPersonalApiKeyState] = useState(() => {
    return localStorage.getItem(PERSONAL_API_KEY_STORAGE) || '';
  });

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    ensureSeeded()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Seed error:', err);
        setDbError(err?.message || 'Lỗi khởi tạo cơ sở dữ liệu.');
      });
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const updateCurrentProfile = useCallback((profileId, updater) => {
    setProfileStates((prev) => {
      const current = prev[profileId] || defaultProfileState();
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      try {
        localStorage.setItem(`binhi_profile_${profileId}`, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return { ...prev, [profileId]: next };
    });
  }, []);

  const switchProfile = useCallback(
    (nextId) => {
      if (nextId !== 'bi' && nextId !== 'nhi') return;
      setActiveProfileId(nextId);
      localStorage.setItem(ACTIVE_PROFILE_KEY, nextId);
      showToast(`Đã chuyển sang hồ sơ học tập của ${PROFILES[nextId].name}`, 'info');
    },
    [showToast]
  );

  const completeOnboarding = useCallback(
    (profileId, levels) => {
      const cleanLevels = levels.length > 0 ? levels : ['HSK1'];
      setActiveProfileId(profileId);
      localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
      updateCurrentProfile(profileId, (curr) => ({
        ...curr,
        onboarded: true,
        targetLevels: cleanLevels,
      }));
    },
    [updateCurrentProfile]
  );

  const setTargetLevels = useCallback(
    (levels) => {
      if (!levels || levels.length === 0) return;
      updateCurrentProfile(activeProfileId, (curr) => ({
        ...curr,
        onboarded: true,
        targetLevels: levels,
      }));
    },
    [activeProfileId, updateCurrentProfile]
  );

  const toggleTargetLevel = useCallback(
    (levelId) => {
      updateCurrentProfile(activeProfileId, (curr) => {
        const exists = curr.targetLevels.includes(levelId);
        if (exists && curr.targetLevels.length === 1) {
          showToast('Cần giữ ít nhất 1 cấp độ HSK mục tiêu.', 'warning');
          return curr;
        }
        const order = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
        const nextLevels = exists
          ? curr.targetLevels.filter((l) => l !== levelId)
          : [...curr.targetLevels, levelId].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return { ...curr, targetLevels: nextLevels };
      });
    },
    [activeProfileId, updateCurrentProfile, showToast]
  );

  const recordStudyActivity = useCallback(() => {
    const today = getTodayStr();
    const yesterday = getYesterdayStr();
    updateCurrentProfile(activeProfileId, (curr) => {
      if (curr.lastStudyDate === today) return curr;
      const nextStreak = curr.lastStudyDate === yesterday ? curr.streak + 1 : 1;
      return {
        ...curr,
        streak: nextStreak,
        bestStreak: Math.max(curr.bestStreak || 0, nextStreak),
        lastStudyDate: today,
      };
    });
  }, [activeProfileId, updateCurrentProfile]);

  const setSpeechRate = useCallback((rate) => {
    const clean = rate === 0.75 ? 0.75 : 1.0;
    setSpeechRateState(clean);
    localStorage.setItem(SPEECH_RATE_KEY, String(clean));
  }, []);

  const setPersonalApiKey = useCallback((key) => {
    const clean = String(key || '').trim();
    setPersonalApiKeyState(clean);
    if (clean) {
      localStorage.setItem(PERSONAL_API_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(PERSONAL_API_KEY_STORAGE);
    }
  }, []);

  const currentProfileState = profileStates[activeProfileId] || defaultProfileState();
  const activeProfile = PROFILES[activeProfileId];

  // Check if streak is still active today or yesterday
  const today = getTodayStr();
  const yesterday = getYesterdayStr();
  const effectiveStreak =
    currentProfileState.lastStudyDate === today || currentProfileState.lastStudyDate === yesterday
      ? currentProfileState.streak
      : 0;

  // Show onboarding if NEITHER Bi nor Nhi has onboarded yet (or current active profile hasn't onboarded)
  const needsOnboarding = !currentProfileState.onboarded;

  const value = {
    activeProfileId,
    activeProfile,
    profileStates,
    targetLevels: currentProfileState.targetLevels,
    streak: effectiveStreak,
    bestStreak: currentProfileState.bestStreak || 0,
    needsOnboarding,
    switchProfile,
    completeOnboarding,
    setTargetLevels,
    toggleTargetLevel,
    recordStudyActivity,
    speechRate,
    setSpeechRate,
    personalApiKey,
    setPersonalApiKey,
    dbReady,
    dbError,
    toasts,
    showToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
