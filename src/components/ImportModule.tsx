/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, FileDown, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import { Word } from "../types";

interface ImportModuleProps {
  onImportComplete: (newWords: Word[]) => void;
  existingWordsCount: number;
}

interface DraftWord {
  english: string;
  chinese: string;
}

export default function ImportModule({ onImportComplete, existingWordsCount }: ImportModuleProps) {
  const [manualInput, setManualInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState("");
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // States for OCR word list staging
  const [stagedWords, setStagedWords] = useState<DraftWord[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  // Convert image to base64 and request backend OCR
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorStatus("请上传有效的图片文件 (png, jpg, jpeg 等)。");
      return;
    }

    setErrorStatus(null);
    setLoading(true);
    setLoadStep("正在读取图片文件...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      if (!base64String) {
        setErrorStatus("文件读取失败。");
        setLoading(false);
        return;
      }

      try {
        setLoadStep("AI 正在识别图中英文单词...");
        const response = await fetch("/api/ocr-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64String }),
        });

        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.words && Array.isArray(data.words)) {
          // Add unique id for UI editing
          setStagedWords(data.words);
          setHasScanned(true);
          if (data.words.length === 0) {
            setErrorStatus("图片中未识别到显著的英文单词。请尝试重新上传清晰的工作纸、单词表，或者手动输入。");
          }
        } else {
          throw new Error("返回的数据结构不符合预期。");
        }
      } catch (err: any) {
        console.error("OCR Image error:", err);
        setErrorStatus(`图片识别失败: ${err.message || "未知服务端错误"}`);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorStatus("文件读取出错。");
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  // Import raw comma/newline English words
  const handleManualImport = () => {
    if (!manualInput.trim()) return;

    // Split words by commas, semicolons, or newlines
    const wordsRaw = manualInput
      .split(/[\n,;，；\t]+/)
      .map((item) => item.trim())
      .filter((item) => /^[a-zA-Z\s'-]+$/.test(item) && item.length > 0);

    if (wordsRaw.length === 0) {
      setErrorStatus("未能识别出有效的纯英文单词。请输入由英文、空格或连字符组成的单词。");
      return;
    }

    // Stage as draft words with empty definition for AI to fill in later
    const duplicatesFiltered = wordsRaw.filter(
      (value, index, self) => self.indexOf(value) === index
    );

    const manualDrafts: DraftWord[] = duplicatesFiltered.map((w) => ({
      english: w.toLowerCase(),
      chinese: "",
    }));

    setStagedWords((prev) => {
      // Avoid staging identical words twice
      const existingEng = prev.map((p) => p.english.toLowerCase());
      const filteredNew = manualDrafts.filter((m) => !existingEng.includes(m.english));
      return [...prev, ...filteredNew];
    });

    setManualInput("");
    setHasScanned(true);
    setErrorStatus(null);
  };

  // Draft Word Management Functions
  const handleUpdateDraft = (index: number, field: "english" | "chinese", value: string) => {
    setStagedWords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteDraft = (index: number) => {
    setStagedWords((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddBlankDraft = () => {
    setStagedWords((prev) => [...prev, { english: "", chinese: "" }]);
  };

  // Core execution: Take staged words, fetch detailed phonetic & exam sentences
  const handleFinalizeImport = async () => {
    // Filter out invalid stages
    const validDrafts = stagedWords.filter((w) => w.english.trim().length > 0);
    if (validDrafts.length === 0) {
      setErrorStatus("当前导入列表为空，请先添加单词。");
      return;
    }

    setLoading(true);
    setErrorStatus(null);
    setLoadStep("AI 正在生成音标、精美中文释义和中英双语例句...");

    try {
      const response = await fetch("/api/generate-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: validDrafts }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.words && Array.isArray(data.words)) {
        // Map detailed results into our official Word structure
        const finalizedWords: Word[] = data.words.map((item: any) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          english: item.english.trim(),
          phonetic: item.phonetic || "[音标未生成]",
          chinese: item.chinese || "未知含义",
          sentence: item.sentence || "No example sentence generated.",
          sentenceTranslation: item.sentenceTranslation || "暂无例句翻译。",
          createdAt: Date.now(),
          incorrectCount: 0,
          correctCount: 0,
          isMastered: false,
        }));

        onImportComplete(finalizedWords);
        
        // Clear staging area upon successful creation
        setStagedWords([]);
        setHasScanned(false);
      } else {
        throw new Error("AI 生成细节反馈格式异常。");
      }
    } catch (err: any) {
      console.error("AI word detail error:", err);
      setErrorStatus(`单词库拼装生成出错: ${err.message || "服务端无响应"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="import-module-container" className="space-y-6">
      {/* Title & Overview Info */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-1">💡 怎么导入单词？</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>方案 A（照片拍照导入）：</strong>支持直接上传或拖拽您的单词卡、教材页、草稿纸照片，AI 将极速抓取并自动关联中英文。</li>
            <li><strong>方案 B（手动拼写导入）：</strong>在输入框输入单词，支持逗号或换行批量输入（例如：<code className="bg-white px-1.5 py-0.5 border rounded border-slate-200">apple, banana, orange</code>）。</li>
            <li><strong>魔法赋能：</strong>所有被导入的英文均会由 <strong>Gemini AI 自动匹配音标、精准翻译、和高质量场景例句</strong>。</li>
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-b-indigo-400 rounded-full animate-ping opacity-25"></div>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-800">AI 正在处理，请稍候...</h3>
            <p className="text-xs text-slate-500 animate-pulse font-mono">{loadStep}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Import Gateways */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">1. 选择导入渠道</h3>
              <p className="text-xs text-slate-400">选择您最方便的单词载入模式</p>
            </div>

            {/* Gateway A: Image OCR */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">📂 拍图/照片文字识别</label>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-50/40 scale-[0.99]"
                    : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
                }`}
              >
                <input
                  type="file"
                  id="ocr-file-picker"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="p-3 bg-indigo-5/60 text-indigo-600 rounded-full mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-slate-700">拖拽照片到这里，或点击选择照片</p>
                <p className="text-[11px] text-slate-400 mt-1">支持英文作业本、单词卡、教材页、屏幕截图</p>
                <div className="mt-3 bg-indigo-100/60 px-2 pl-2.5 py-1 rounded text-[10px] text-indigo-700 font-semibold flex items-center gap-1">
                  🛡️ Vercel 友好模式：纯内存转换，不储存临时盘
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <span className="relative bg-white px-3 text-[10px] font-bold tracking-wider text-slate-400">或</span>
            </div>

            {/* Gateway B: Manual typing input */}
            <div className="space-y-2">
              <label htmlFor="manual-text-input" className="text-xs font-semibold text-slate-600 block">✍️ 手动录入英文</label>
              <div className="space-y-2">
                <textarea
                  id="manual-text-input"
                  rows={3}
                  placeholder="英语单词支持换行或逗号分隔，例如：
obvious, coordinate, persistent, discipline"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-350 outline-none resize-none font-mono"
                />
                <button
                  id="manual-add-btn"
                  onClick={handleManualImport}
                  disabled={!manualInput.trim()}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-lg text-xs font-medium transition duration-150 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  拼解析入预览台
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Staged Preview / Checklist */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col h-[520px]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">2. 单词预览与微调台</h3>
                <p className="text-xs text-slate-400">
                  当前处于暂存区：共计 <span className="font-semibold text-indigo-600">{stagedWords.length}</span> 个词组
                </p>
              </div>
              {hasScanned && stagedWords.length > 0 && (
                <button
                  id="add-blank-draft-btn"
                  onClick={handleAddBlankDraft}
                  className="p-1 px-2 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-indigo-600 rounded text-xs flex items-center gap-0.5 font-medium transition duration-150"
                >
                  <Plus className="w-3.5 h-3.5" />
                  补录加词
                </button>
              )}
            </div>

            {/* Staging Body list */}
            <div className="flex-1 overflow-y-auto border border-slate-100 bg-slate-50/50 rounded-xl p-3 space-y-2 mb-4 scrollbar-thin">
              {stagedWords.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <FileDown className="w-10 h-10 text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-xs">暂无单词在此预览</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[240px]">
                    在左侧上传照片或手动添加后，被解析出的单词会罗列在此处由您二次调整。
                  </p>
                </div>
              ) : (
                stagedWords.map((item, idx) => (
                  <div
                    key={`draft-${idx}`}
                    className="flex items-center gap-2 p-2 bg-white border border-slate-200/60 rounded-lg group hover:border-indigo-300/80 transition duration-150 shadow-sm"
                  >
                    <span className="text-[10px] font-mono font-semibold text-slate-450 w-5 shrink-0 text-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      id={`draft-english-${idx}`}
                      placeholder="Word (英文)"
                      value={item.english}
                      onChange={(e) => handleUpdateDraft(idx, "english", e.target.value)}
                      className="flex-1 text-xs px-2 py-1 border border-slate-150 bg-slate-50 rounded font-mono font-medium focus:bg-white text-slate-800 outline-none"
                    />
                    <input
                      type="text"
                      id={`draft-chinese-${idx}`}
                      placeholder="可选：释义"
                      value={item.chinese}
                      onChange={(e) => handleUpdateDraft(idx, "chinese", e.target.value)}
                      className="flex-1 text-xs px-2 py-1 border border-indigo-50 bg-indigo-50/10 rounded focus:bg-white text-slate-700 outline-none"
                    />
                    <button
                      id={`delete-draft-btn-${idx}`}
                      onClick={() => handleDeleteDraft(idx)}
                      className="p-1 text-slate-350 hover:text-rose-500 rounded hover:bg-rose-50 transition duration-150 shrink-0"
                      title="移除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Staging bottom trigger */}
            <div className="space-y-3">
              {errorStatus && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-rose-600 text-[11px] leading-relaxed animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">提示：</span>
                    {errorStatus}
                  </div>
                </div>
              )}

              {stagedWords.length > 0 ? (
                <button
                  id="generate-details-finalize-btn"
                  onClick={handleFinalizeImport}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-[0.99] text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-150 transition-all duration-150 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                  导入并自动生成 AI 音标 + 例句
                </button>
              ) : (
                <div className="py-2.5 bg-slate-100 text-slate-400 text-center rounded-xl text-xs font-semibold select-none border border-slate-200/50">
                  请在左侧载入单词以激活
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
