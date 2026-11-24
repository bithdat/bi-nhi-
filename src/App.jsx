import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { ToastContainer } from './components/common/ToastContainer';
import { BrandLogo } from './components/common/BrandLogo';
import { OnboardingModal } from './pages/OnboardingModal';
import { Dashboard } from './pages/Dashboard';
import { Vocabulary } from './pages/Vocabulary';
import { Flashcards } from './pages/Flashcards';
import { ArcadeHub } from './pages/ArcadeHub';
import { ExamRoom } from './pages/ExamRoom';
import { AiStudio } from './pages/AiStudio';
import { Settings } from './pages/Settings';

function AppShell() {
  const { dbReady, dbError, needsOnboarding } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (dbError) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <BrandLogo size="lg" />
        <p className="text-sm text-red-700 max-w-md">{dbError}</p>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <BrandLogo size="lg" showSubtitle />
        <p className="text-xs text-slate-500 animate-pulse">
          Đang chuẩn bị 4.605 từ vựng chuẩn HSK 3.0...
        </p>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <>
        <OnboardingModal />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <AppLayout activeTab={activeTab} onNavigate={setActiveTab}>
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'vocabulary' && <Vocabulary />}
        {activeTab === 'flashcards' && <Flashcards />}
        {activeTab === 'arcade' && <ArcadeHub />}
        {activeTab === 'exam' && <ExamRoom />}
        {activeTab === 'ai' && <AiStudio onNavigate={setActiveTab} />}
        {activeTab === 'settings' && <Settings />}
      </AppLayout>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
