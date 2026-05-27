/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Search, Volume2, Check, Award, Trash2, HelpCircle, Eye, EyeOff, BookOpen, Stars } from "lucide-react";
import { Word } from "../types";

interface WordLibraryProps {
  words: Word[];
  onToggleMaster: (id: string) => void;
  onDeleteWord: (id: string) => void;
}

export default function WordLibrary({ words, onToggleMaster, onDeleteWord }: WordLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "incorrect" | "mastered" | "unmastered">("all");
  const [hideDetails, setHideDetails] = useState(false); // Enable a memory quiz mode

  // Speech Synthesizer
  const playPronunciation = (word_en: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word_en);
      utterance.lang = "en-US";
      
      const voices = window.speechSynthesis.getVoices();
      // Try to match standard English
      const voice = voices.find(v => v.lang.startsWith("en-") || v.lang === "en-US");
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 0.85; // slightly slower for educational clarity
      window.speechSynthesis.speak(utterance);
    }
  };

  // Filter and search words
  const filteredWords = words.filter((word) => {
    const matchesSearch =
      word.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
      word.chinese.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === "incorrect") {
      return word.incorrectCount > 0; // 错词库 mode
    }
    if (filterMode === "mastered") {
      return word.isMastered;
    }
    if (filterMode === "unmastered") {
      return !word.isMastered;
    }
    return true;
  });

  return (
    <div id="word-library-container" className="space-y-6">
      {/* Search & Controller Dashboard Bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="word-search-input"
            placeholder="搜索英文单词或中文释义..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            id="filter-tab-all"
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 ${
              filterMode === "all"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-150"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            全部 ({words.length})
          </button>
          <button
            id="filter-tab-incorrect"
            onClick={() => setFilterMode("incorrect")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 flex items-center gap-1 ${
              filterMode === "incorrect"
                ? "bg-rose-500 text-white shadow-sm shadow-rose-150"
                : "bg-rose-50/70 text-rose-600 hover:bg-rose-100/70"
            }`}
          >
            错词复习库 ({words.filter((w) => w.incorrectCount > 0).length})
          </button>
          <button
            id="filter-tab-mastered"
            onClick={() => setFilterMode("mastered")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 ${
              filterMode === "mastered"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-150"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            已掌握 ({words.filter((w) => w.isMastered).length})
          </button>
          <button
            id="filter-tab-unmastered"
            onClick={() => setFilterMode("unmastered")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 ${
              filterMode === "unmastered"
                ? "bg-slate-800 text-white shadow-sm shadow-slate-200"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            未掌握 ({words.filter((w) => !w.isMastered).length})
          </button>
        </div>

        {/* Self Memorizing Switch */}
        <button
          id="toggle-hide-details-btn"
          onClick={() => setHideDetails(!hideDetails)}
          className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition duration-150 ${
            hideDetails
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "border-slate-200 hover:bg-slate-100 text-slate-600"
          }`}
          title="隐藏中文及例句以进行自我卡片默记"
        >
          {hideDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          卡片背诵模式 ({hideDetails ? "隐藏细节" : "显示全部"})
        </button>
      </div>

      {hideDetails && (
        <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
          <Stars className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
          <p>
            <strong>卡片背诵模式：</strong>已为您暂时遮隔了词意和例句。您可以看着单词脑补中文和读音后，点击卡片下方各选项即可。适合非拼写下的日常碎片背诵。
          </p>
        </div>
      )}

      {/* Grid of Word Cards */}
      {filteredWords.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <BookOpen className="w-12 h-12 text-slate-300 stroke-[1.2] mx-auto mb-3" />
          <p className="text-sm font-medium">当前列表为空</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery ? "换一个搜索关键字试试吧！" : "请先通过顶部的‘导入新词组’页面，扫图或手动录入单词。"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWords.map((word) => (
            <div
              key={word.id}
              id={`word-card-${word.id}`}
              className={`bg-white border rounded-2xl p-4 shadow-sm relative transition duration-200 flex flex-col justify-between group overflow-hidden ${
                word.isMastered
                  ? "border-emerald-100 bg-emerald-50/5/30"
                  : word.incorrectCount > 0
                  ? "border-rose-100 hover:border-indigo-400"
                  : "border-slate-100 hover:border-slate-200 hover:shadow-md"
              }`}
            >
              {/* Badge markers in background */}
              {word.incorrectCount > 0 && (
                <div className="absolute top-0 right-0 bg-rose-500 text-white font-mono text-[9px] px-2 py-0.5 rounded-bl font-semibold uppercase tracking-wider scale-[0.9]">
                  错词 {word.incorrectCount}次
                </div>
              )}

              {/* Card top */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    {/* English vocab heading */}
                    <h4 className="text-base font-bold text-slate-800 font-sans tracking-tight flex items-center gap-1.5">
                      {word.english}
                      <button
                        id={`pronounce-btn-${word.id}`}
                        onClick={() => playPronunciation(word.english)}
                        className="p-1 bg-indigo-50/50 hover:bg-indigo-100/60 active:bg-indigo-200/50 text-indigo-650 rounded-full transition duration-150 shrink-0"
                        title="发音"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </h4>
                    {/* Phonetic Symbols */}
                    <span className="text-[11px] font-mono text-indigo-500 font-medium">
                      {word.phonetic}
                    </span>
                  </div>
                  
                  {/* Status checklist metrics */}
                  <div className="flex items-center gap-1">
                    {word.correctCount > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" title="默写正确次数">
                        对 {word.correctCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Definition Body */}
                <div className="space-y-2 pt-1 border-t border-slate-50">
                  <p
                    className={`text-xs text-slate-750 font-medium leading-relaxed ${
                      hideDetails ? "bg-slate-100 text-transparent select-none rounded animate-pulse" : ""
                    }`}
                  >
                    {word.chinese}
                  </p>

                  {/* Context sentence */}
                  <div
                    className={`bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 space-y-1 ${
                      hideDetails ? "invisible opacity-0 h-0 p-0 overflow-hidden" : ""
                    }`}
                  >
                    <p className="text-[11px] text-slate-700 italic font-medium leading-normal select-text">
                      {word.sentence}
                    </p>
                    <p className="text-[10px] text-slate-450 leading-relaxed select-text">
                      {word.sentenceTranslation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Bottom Interaction Area */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                <button
                  id={`toggle-master-btn-${word.id}`}
                  onClick={() => onToggleMaster(word.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition duration-150 flex items-center gap-1 ${
                    word.isMastered
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : "bg-slate-50 hover:bg-slate-150 border border-transparent text-slate-600 hover:border-slate-200"
                  }`}
                  title={word.isMastered ? "设为未掌握" : "设为已掌握并移出复习库"}
                >
                  <Check className={`w-3.5 h-3.5 ${word.isMastered ? "stroke-[2.5]" : "opacity-40"}`} />
                  {word.isMastered ? "已掌握" : "标为掌握"}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    id={`delete-word-btn-${word.id}`}
                    onClick={() => onDeleteWord(word.id)}
                    className="p-1 px-1.5 border border-transparent text-slate-350 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition duration-150"
                    title="彻底删除此词组"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
