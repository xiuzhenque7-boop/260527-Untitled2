/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Volume2, CheckCircle2, XCircle, ChevronRight, HelpCircle, ArrowLeft, RotateCcw, Award, Sparkles, BookOpen } from "lucide-react";
import { Word, DictationSession } from "../types";

interface DictationModuleProps {
  words: Word[];
  onSessionComplete: (results: { wordId: string; isCorrect: boolean }[]) => void;
  onBackToLibrary: () => void;
}

export default function DictationModule({ words, onSessionComplete, onBackToLibrary }: DictationModuleProps) {
  // Config Session State
  const [testMode, setTestMode] = useState<'all' | 'review' | 'custom'>('all');
  const [maxWordsCount, setMaxWordsCount] = useState<number>(10);
  const [clueMode, setClueMode] = useState<{ chinese: boolean; audio: boolean; sentence: boolean }>({
    chinese: true,
    audio: true,
    sentence: false,
  });

  // Session Operational State
  const [session, setSession] = useState<DictationSession | null>(null);
  const [userInput, setUserInput] = useState("");
  const [hasChecked, setHasChecked] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stats to show on Finish
  const [isFinishedReport, setIsFinishedReport] = useState(false);

  // Initialize Word Voice Broadcaster
  const playWordVoice = (wordTxt: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(wordTxt);
      utterance.lang = "en-US";
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith("en-") || v.lang === "en-US");
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 0.82;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Helper function to safely mask the spelling inside the example sentence
  const getMaskedSentence = (sentence: string, targetWord: string) => {
    if (!sentence || !targetWord) return "";
    // Case-insensitive replacement with underline matching length or blank space
    try {
      const escaped = targetWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\w*\\b`, "gi");
      return sentence.replace(regex, (match) => "_______");
    } catch {
      return sentence;
    }
  };

  // Start the dictation session
  const handleStartSession = () => {
    // Filter words based on chosen mode
    let targetPool: Word[] = [];
    if (testMode === 'review') {
      targetPool = words.filter(w => w.incorrectCount > 0);
    } else {
      targetPool = [...words];
    }

    if (targetPool.length === 0) {
      return; // Handled in UI render
    }

    // Shuffle the target pool
    const shuffled = [...targetPool].sort(() => 0.5 - Math.random());
    // Limit to user chosen count
    const selectedWords = shuffled.slice(0, Math.min(maxWordsCount, shuffled.length));

    setSession({
      id: `session-${Date.now()}`,
      words: selectedWords,
      currentIndex: 0,
      results: [],
      isFinished: false,
      startedAt: Date.now(),
      mode: testMode,
    });
    setIsFinishedReport(false);
    setUserInput("");
    setHasChecked(false);

    // Auto audio cue of the first word
    if (clueMode.audio && selectedWords.length > 0) {
      setTimeout(() => {
        playWordVoice(selectedWords[0].english);
      }, 500);
    }
  };

  // Handle key submission and word verification
  const handleVerifyWord = () => {
    if (!session || hasChecked) return;

    const currentWord = session.words[session.currentIndex];
    const cleanedUser = userInput.trim().toLowerCase();
    const cleanedTarget = currentWord.english.trim().toLowerCase();
    
    // We treat spacing boundaries and exact match
    const isCorrect = cleanedUser === cleanedTarget;

    setSession(prev => {
      if (!prev) return prev;
      const updatedResults = [
        ...prev.results,
        {
          wordId: currentWord.id,
          english: currentWord.english,
          userInput: userInput,
          isCorrect,
        }
      ];
      return {
        ...prev,
        results: updatedResults,
      };
    });

    setHasChecked(true);

    // Provide voice synthesis feedback of original word for correction
    if (clueMode.audio) {
      playWordVoice(currentWord.english);
    }
  };

  // Proceed to next question or end the session
  const handleNextWord = () => {
    if (!session) return;

    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= session.words.length) {
      // Session finished
      onSessionComplete(session.results);
      setIsFinishedReport(true);
      setSession(prev => prev ? { ...prev, isFinished: true } : null);
    } else {
      // Go to next
      setSession(prev => prev ? { ...prev, currentIndex: nextIndex } : null);
      setUserInput("");
      setHasChecked(false);
      // Auto-focus field
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);

      // Speak next word automatically
      if (clueMode.audio) {
        setTimeout(() => {
          const nextWordText = session.words[nextIndex].english;
          playWordVoice(nextWordText);
        }, 150);
      }
    }
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (!hasChecked) {
        handleVerifyWord();
      } else {
        handleNextWord();
      }
    }
  };

  // Pre-load filter stats
  const countIncorrectPool = words.filter(w => w.incorrectCount > 0).length;

  // Render setup / session config page if no session is running or finished
  if (!session || isFinishedReport) {
    return (
      <div id="setup-panel-container" className="max-w-xl mx-auto space-y-6">
        {isFinishedReport && session ? (
          // Session Result Report Card
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-6 text-center animate-fade-in">
            <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-800">默写完成！</h2>
              <p className="text-xs text-slate-500">
                测试模式: {session.mode === 'all' ? '全部词库' : session.mode === 'review' ? '错词背备考' : '定制速配测'}
              </p>
            </div>

            {/* Score circle detail */}
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center justify-around">
              <div>
                <span className="block text-2xl font-bold text-emerald-600">
                  {session.results.filter(r => r.isCorrect).length}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wide block uppercase">正确数目</span>
              </div>
              <div className="h-8 w-px bg-slate-205"></div>
              <div>
                <span className="block text-2xl font-bold text-slate-850">
                  {Math.round((session.results.filter(r => r.isCorrect).length / session.words.length) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wide block uppercase">正确率</span>
              </div>
              <div className="h-8 w-px bg-slate-205"></div>
              <div>
                <span className="block text-2xl font-bold text-rose-500">
                  {session.results.filter(r => !r.isCorrect).length}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wide block uppercase">错词记录</span>
              </div>
            </div>

            {/* Detailed Spelling Error Table review */}
            <div className="text-left space-y-2">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest pl-1">测验明细 review</h3>
              <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1.5 scrollbar-thin">
                {session.results.map((res, index) => {
                  const correlatedWord = session.words.find(w => w.id === res.wordId);
                  return (
                    <div
                      key={`report-row-${index}`}
                      className="flex items-start gap-2.5 p-2 bg-white border border-slate-100 rounded-lg text-xs"
                    >
                      {res.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-550 shrink-0 mt-0.5" />
                      )}
                      
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800">{res.english}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {correlatedWord?.phonetic}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          解释: {correlatedWord?.chinese}
                        </p>
                        {!res.isCorrect && (
                          <div className="text-[10px] bg-rose-50 border border-rose-100/30 text-rose-600 px-1.5 py-0.5 rounded mt-1 font-mono">
                            您的拼写: <span className="font-semibold line-through">{res.userInput || "[空白]"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                id="redo-test-btn"
                onClick={handleStartSession}
                className="flex-1 py-2 bg-indigo-650 hover:bg-indigo-700 hover:shadow shadow-indigo-150 active:scale-[0.99] text-white font-semibold text-xs rounded-xl transition-all duration-150"
              >
                再试一次
              </button>
              <button
                id="quit-back-btn"
                onClick={onBackToLibrary}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition duration-150"
              >
                返回主库面
              </button>
            </div>
          </div>
        ) : (
          // Normal Configuration View
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                <BookOpen className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">🎯 创建智能背单词默写</h2>
                <p className="text-[11px] text-slate-400">选择您本次测验的范围、规模和辅助提示条件</p>
              </div>
            </div>

            {/* Part 1: Word Ranges */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">1. 默写词库来源</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="mode-picker-all"
                  onClick={() => setTestMode('all')}
                  className={`border p-3.5 rounded-xl transition duration-150 text-left space-y-1 relative ${
                    testMode === 'all'
                      ? 'border-indigo-500 bg-indigo-50/10'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-800">全部词库 ({words.length})</p>
                  <p className="text-[10px] text-slate-400">从当前导入的所有单词中随机抽取测验</p>
                </button>
                <button
                  id="mode-picker-review"
                  onClick={() => setTestMode('review')}
                  disabled={countIncorrectPool === 0}
                  className={`border p-3.5 rounded-xl transition duration-150 text-left space-y-1 relative ${
                    countIncorrectPool === 0 ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    testMode === 'review'
                      ? 'border-rose-500 bg-rose-50/10'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-800">错词备考库 ({countIncorrectPool})</p>
                  <p className="text-[10px] text-slate-400">针对之前默默写出错过的重点单词进行巩固</p>
                  {countIncorrectPool > 0 && (
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Part 2: Quantities picker */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">2. 默写抽测题数</label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20, 30].map(cnt => (
                  <button
                    key={`qty-${cnt}`}
                    id={`qty-btn-${cnt}`}
                    onClick={() => setMaxWordsCount(cnt)}
                    className={`px-3.5 py-1.5 border rounded-lg text-xs font-semibold select-none transition duration-150 ${
                      maxWordsCount === cnt
                        ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    {cnt}个单词
                  </button>
                ))}
              </div>
            </div>

            {/* Part 3: Clue options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">3. 默写辅助提示条件</label>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50/50 px-1.5 py-0.5 rounded">多选支持</span>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 p-2 bg-slate-50 border border-slate-150 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clueMode.chinese}
                    onChange={(e) => setClueMode(prev => ({ ...prev, chinese: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">中文释义提示</span>
                    <span className="text-[10px] text-slate-450">默写中看到中文释义进行脑补拼写</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 border border-slate-150 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clueMode.audio}
                    onChange={(e) => setClueMode(prev => ({ ...prev, audio: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">自动美式发音听写</span>
                    <span className="text-[10px] text-slate-450">切换下一词时自动并手动点击真人语音进行听写</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 border border-slate-150 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!words.some(w => w.sentence)}
                    checked={clueMode.sentence}
                    onChange={(e) => setClueMode(prev => ({ ...prev, sentence: e.target.checked }))}
                    className="disabled:opacity-40 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-slate-300 pointer-events-auto"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">挖空例句语境提示</span>
                    <span className="text-[10px] text-slate-450">显示遮盖了目标词的例句，通过语感和语境默写拼词</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Launch trigger button */}
            {words.length === 0 ? (
              <div className="p-3.5 bg-slate-100 text-slate-450 text-center rounded-xl text-xs font-medium border border-slate-200">
                ⚠️ 当前应用词库暂无单词，请先返回主页导入一些单词后开始！
              </div>
            ) : testMode === "review" && countIncorrectPool === 0 ? (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-center rounded-xl text-xs font-medium">
                错词复习库目前干净清零！请用“全部词库”练习拼写进行积累！
              </div>
            ) : (
              <button
                id="start-session-trigger"
                onClick={handleStartSession}
                className="w-full py-3 bg-gradient-to-r from-indigo-650 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 font-semibold text-xs text-white rounded-xl shadow-md shadow-indigo-150 transition duration-150"
              >
                🚀 开始单词默写测验
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Session Active Stage View
  const currentWord = session.words[session.currentIndex];

  return (
    <div id="active-session-deck" className="max-w-xl mx-auto space-y-6">
      {/* Active Session Header metrics bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
        <button
          id="exit-session-early-btn"
          onClick={() => {
            if (confirm("确定要退出本次默写吗？当前测试进度将丢失。")) {
              setSession(null);
            }
          }}
          className="text-xs text-slate-505 font-medium hover:text-slate-800 transition duration-150 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          放弃退出
        </button>

        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
          进度: {session.currentIndex + 1} / {session.words.length}
        </span>
      </div>

      {/* Progress timeline bar */}
      <div className="w-full bg-slate-150 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-indigo-600 h-1.5 transition-all duration-300"
          style={{ width: `${((session.currentIndex + 1) / session.words.length) * 100}%` }}
        ></div>
      </div>

      {/* Clue Prompt Flashcard */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="text-center space-y-4 py-3">
          {/* Top Audio Action Trigger always available in exam if enabled */}
          {clueMode.audio && (
            <button
              id={`audio-trigger-moxie-${currentWord.id}`}
              onClick={() => playWordVoice(currentWord.english)}
              className="mx-auto w-12 h-12 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-700 text-indigo-600 rounded-full flex items-center justify-center transition-all duration-150 shadow-sm active:scale-95"
              title="播音"
            >
              <Volume2 className="w-5 h-5 animate-pulse" />
            </button>
          )}

          {/* Prompt 1: Chinese clue */}
          {clueMode.chinese && (
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">释义</span>
              <p className="text-base font-bold text-slate-750 max-w-sm mx-auto leading-relaxed">
                {currentWord.chinese}
              </p>
            </div>
          )}

          {/* Prompt 2: Inline masked sentence clue */}
          {clueMode.sentence && currentWord.sentence && (
            <div className="space-y-1 px-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-100 inline-block text-left w-full mt-2">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">语境挖空例句</span>
              <p className="text-xs text-slate-700 leading-normal italic font-medium font-sans select-none">
                {getMaskedSentence(currentWord.sentence, currentWord.english)}
              </p>
              <p className="text-[10px] text-slate-400 leading-normal mt-1">
                译: {currentWord.sentenceTranslation}
              </p>
            </div>
          )}
        </div>

        {/* Input Text Box Verification Form */}
        <div className="space-y-4">
          <div className="space-y-1 relative">
            <label htmlFor="dictation-english-input" className="text-[10px] font-bold text-slate-400 block tracking-widest uppercase">请拼写出英文单词</label>
            <input
              type="text"
              id="dictation-english-input"
              ref={inputRef}
              disabled={hasChecked}
              value={userInput}
              onKeyDown={handleKeyDown}
              onChange={(e) => setUserInput(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="在这里拼写该英文..."
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold tracking-wide font-mono outline-none border transition duration-150 ${
                hasChecked
                  ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                  : isInputFocused
                  ? "border-indigo-500 bg-white ring-2 ring-indigo-500/10"
                  : "border-slate-205 focus:border-indigo-400"
              }`}
            />
          </div>

          {/* Feedback details (Spans out after Checked state) */}
          {hasChecked && (
            <div className={`p-4 rounded-2xl border animate-fade-in space-y-3 ${
              userInput.trim().toLowerCase() === currentWord.english.trim().toLowerCase()
                ? "bg-emerald-50/50 border-emerald-100 text-emerald-700"
                : "bg-rose-50/50 border-rose-100 text-rose-700"
            }`}>
              <div className="flex items-start gap-2">
                {userInput.trim().toLowerCase() === currentWord.english.trim().toLowerCase() ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-bold">
                    {userInput.trim().toLowerCase() === currentWord.english.trim().toLowerCase()
                      ? "恭喜！拼写正确。"
                      : "抱歉，拼写有误。"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 font-mono flex-wrap">
                    <span className="text-slate-505 text-[10px]">正确拼写:</span>
                    <span className="font-extrabold text-slate-800 text-xs tracking-wide bg-white px-2 py-0.5 rounded border">
                      {currentWord.english}
                    </span>
                    <span className="text-indigo-650 text-[10px] font-semibold">{currentWord.phonetic}</span>
                  </div>
                </div>
              </div>

              {/* Expand the double line contextual review context standard */}
              <div className="border-t border-slate-200/50 pt-2.5 mt-2 text-xs space-y-1 select-text">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">精美完整原句复盘</span>
                <p className="font-sans text-slate-700 font-medium italic select-text leading-normal">
                  {currentWord.sentence}
                </p>
                <p className="text-[10px] text-slate-450 select-text leading-normal">
                  {currentWord.sentenceTranslation}
                </p>
              </div>
            </div>
          )}

          {/* Big operational controls row */}
          <div>
            {!hasChecked ? (
              <button
                id="submit-moxie-word-btn"
                onClick={handleVerifyWord}
                disabled={!userInput.trim()}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 font-bold text-xs text-white rounded-xl transition duration-150 disabled:opacity-50"
              >
                提交拼写答案 (Enter)
              </button>
            ) : (
              <button
                id="next-moxie-word-btn"
                onClick={handleNextWord}
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 hover:shadow active:scale-[0.99] font-bold text-xs text-white rounded-xl transition duration-150 flex items-center justify-center gap-1"
              >
                {session.currentIndex + 1 >= session.words.length ? "查看测试报告" : "继续拼写下一词"}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
