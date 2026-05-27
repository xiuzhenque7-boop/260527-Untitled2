/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BookOpen, Upload, PenTool, CheckCircle, GraduationCap, RefreshCw, BarChart2, Star, Trash2 } from "lucide-react";
import { Word } from "./types";
import ImportModule from "./components/ImportModule";
import WordLibrary from "./components/WordLibrary";
import DictationModule from "./components/DictationModule";

// Default educational vocab with premium content for pristine initial state quality
const DEFAULT_WORDS: Word[] = [
  {
    id: "default-1",
    english: "persistent",
    phonetic: "/pəˈsɪstənt/",
    chinese: "adj. 坚持不懈的；执着的；持续的",
    sentence: "Her persistent efforts eventually earned her the trust of the entire research team.",
    sentenceTranslation: "她坚韧不懈的努力最终赢得了整个研究团队的信任。",
    createdAt: Date.now() - 3600000 * 24, // 1 day ago
    incorrectCount: 1, // Let's make one incorrect to preload the wrong words review list so user can test instantly!
    correctCount: 2,
    isMastered: false,
  },
  {
    id: "default-2",
    english: "discipline",
    phonetic: "/ˈdɪsəplɪn/",
    chinese: "n. 纪律；自律；训练；学科",
    sentence: "Self-discipline is the golden key to unlocking academic success and long-term habits.",
    sentenceTranslation: "自我克制与自律是开启学术成功与长期习惯培养的金色钥匙。",
    createdAt: Date.now() - 3600000 * 12,
    incorrectCount: 0,
    correctCount: 4,
    isMastered: true,
  },
  {
    id: "default-3",
    english: "coordinate",
    phonetic: "/kəʊˈɔːdɪneɪt/",
    chinese: "v. 协调；配合；n. 坐标 ；adj. 同等重要的",
    sentence: "We must carefully coordinate our strategies to make sure the app works and compiles perfectly.",
    sentenceTranslation: "我们必须仔细协调各自的策略，以确保应用软件能够完美运行并顺利编译。",
    createdAt: Date.now() - 3600000 * 6,
    incorrectCount: 0,
    correctCount: 0,
    isMastered: false,
  }
];

export default function App() {
  const [words, setWords] = useState<Word[]>([]);
  const [activeTab, setActiveTab] = useState<"library" | "import" | "dictation">("library");

  // Load words from standard persistent offline localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("DICTATION_WORDS_STORE");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWords(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not read vocabulary from localStorage.", e);
    }
    // Fallback to default mock list so that the app opens with premium look
    setWords(DEFAULT_WORDS);
  }, []);

  // Save words dynamically
  const saveWords = (updatedWords: Word[]) => {
    setWords(updatedWords);
    try {
      localStorage.setItem("DICTATION_WORDS_STORE", JSON.stringify(updatedWords));
    } catch (e) {
      console.error("Failed to write to localStorage:", e);
    }
  };

  // 1. Join newly scanned/typed words into master list
  const handleImportNewWords = (newWords: Word[]) => {
    // Avoid exact duplicate English collision
    const existingEnglishSet = new Set(words.map(w => w.english.toLowerCase()));
    const deDuplicatedNew = newWords.filter(nw => !existingEnglishSet.has(nw.english.toLowerCase()));

    const merged = [...deDuplicatedNew, ...words];
    saveWords(merged);
    setActiveTab("library"); // auto return to table layout
  };

  // 2. Mark master toggle
  const handleToggleMaster = (id: string) => {
    const updated = words.map(w => {
      if (w.id === id) {
        return { ...w, isMastered: !w.isMastered };
      }
      return w;
    });
    saveWords(updated);
  };

  // 3. Clear specific item
  const handleDeleteWord = (id: string) => {
    if (confirm("您确定要从词库里彻底移除这个单词吗？（此操作不可逆）")) {
      const filtered = words.filter(w => w.id !== id);
      saveWords(filtered);
    }
  };

  // 4. Update correctness scoring analytics after an active exam session finished
  const handleSessionFinished = (sessionResults: { wordId: string; isCorrect: boolean }[]) => {
    const updated = words.map(w => {
      const match = sessionResults.find(r => r.wordId === w.id);
      if (match) {
        return {
          ...w,
          correctCount: match.isCorrect ? w.correctCount + 1 : w.correctCount,
          incorrectCount: !match.isCorrect ? w.incorrectCount + 1 : w.incorrectCount,
          lastTestedAt: Date.now(),
          // Automatically clear mastered state if they specify incorrect spelling in a review test!
          isMastered: match.isCorrect ? w.isMastered : false,
        };
      }
      return w;
    });
    saveWords(updated);
  };

  // Global Quick Action: Reset entire library to default to preview again
  const handleResetToDefaults = () => {
    if (confirm("此重置将会用演示单词覆盖您的当前库。确定吗？")) {
      saveWords(DEFAULT_WORDS);
      setActiveTab("library");
    }
  };

  // Global Quick Action: Clear all
  const handleClearAllWords = () => {
    if (confirm("提示：这将永久清空当前所有的英文单词，是否继续？")) {
      saveWords([]);
      setActiveTab("import");
    }
  };

  // Statistics Calculation
  const totalCount = words.length;
  const masteredCount = words.filter(w => w.isMastered).length;
  const incorrectCount = words.filter(w => w.incorrectCount > 0).length;
  const testedCount = words.filter(w => w.correctCount > 0 || w.incorrectCount > 0).length;

  return (
    <div id="app-root-wrapper" className="min-h-screen bg-slate-50/50 flex flex-col justify-between">
      {/* Premium Elegant Header Bar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-150 transition-all duration-200">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-800">极简单词默写库</h1>
              <p className="text-[10px] text-slate-400 font-medium font-mono">Word Dictation & AI Assistant</p>
            </div>
          </div>

          {/* Core Tab Navigation */}
          <nav className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
            <button
              id="tab-trigger-library"
              onClick={() => setActiveTab("library")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-150 flex items-center gap-1.5 ${
                activeTab === "library"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-505 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              单词账本 ({totalCount})
            </button>
            <button
              id="tab-trigger-import"
              onClick={() => setActiveTab("import")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-150 flex items-center gap-1.5 ${
                activeTab === "import"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-505 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              导入新词组
            </button>
            <button
              id="tab-trigger-dictation"
              onClick={() => setActiveTab("dictation")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-150 flex items-center gap-1.5 ${
                activeTab === "dictation"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-505 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              开始默写
              {incorrectCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </button>
          </nav>

          {/* Quick System Reset / Sandbox Helpers */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              id="reset-demo-action"
              onClick={handleResetToDefaults}
              className="p-1 px-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-705 flex items-center gap-1 transition duration-150 text-[10px]"
              title="载入官方演示例词"
            >
              <RefreshCw className="w-3 h-3" />
              重填预载
            </button>
            <button
              id="clear-all-action"
              onClick={handleClearAllWords}
              className="p-1 px-2 border border-rose-100 hover:border-rose-200 hover:bg-rose-50 rounded text-rose-500 flex items-center gap-1 transition duration-150 text-[10px]"
              title="清空当前所有的英文"
            >
              <Trash2 className="w-3 h-3" />
              清空
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Dynamic analytics dashboard (Hidden while active dictation session is working for immersion) */}
        {activeTab !== "dictation" && (
          <section id="statistics-dashboard" className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
            {/* Metric 1 */}
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-xl">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs text-slate-400 font-semibold tracking-wider uppercase">账本总数</span>
                <span className="text-base font-extrabold text-slate-800">{totalCount} <span className="text-[10px] text-slate-400 font-normal">个</span></span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs text-slate-400 font-semibold tracking-wider uppercase">已掌握词组</span>
                <span className="text-base font-extrabold text-emerald-605">
                  {masteredCount} <span className="text-[10px] text-slate-400 font-normal">({totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0}%)</span>
                </span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <Star className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs text-slate-400 font-semibold tracking-wider uppercase">错词记录本</span>
                <span className="text-base font-extrabold text-rose-500">
                  {incorrectCount} <span className="text-[10px] text-slate-400 font-normal">个词</span>
                </span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs text-slate-400 font-semibold tracking-wider uppercase">已过关测验</span>
                <span className="text-base font-extrabold text-slate-700">
                  {testedCount} / {totalCount} <span className="text-[10px] text-slate-400 font-normal">词</span>
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Tab Switch Router Display Area */}
        <section id="router-stage" className="transition-all duration-250 animate-fade-in">
          {activeTab === "library" && (
            <WordLibrary
              words={words}
              onToggleMaster={handleToggleMaster}
              onDeleteWord={handleDeleteWord}
            />
          )}

          {activeTab === "import" && (
            <ImportModule
              existingWordsCount={totalCount}
              onImportComplete={handleImportNewWords}
            />
          )}

          {activeTab === "dictation" && (
            <DictationModule
              words={words}
              onSessionComplete={handleSessionFinished}
              onBackToLibrary={() => setActiveTab("library")}
            />
          )}
        </section>
      </main>

      {/* Modern Compact Minimal Humanized Footer */}
      <footer className="bg-white border-t border-slate-100/80 py-4 mt-12 text-center text-[11px] text-slate-400 font-sans tracking-wide">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p>英文单词自主闭环默写平台 · 搭载 Gemini AI 智能极速解析</p>
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 border border-slate-100 rounded text-slate-500">
            <span>● Backend Service:</span>
            <span className="text-indigo-600 font-semibold">Active Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
