/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Word {
  id: string;
  english: string;
  phonetic: string;
  chinese: string;
  sentence: string;
  sentenceTranslation: string;
  createdAt: number;
  incorrectCount: number;
  correctCount: number;
  lastTestedAt?: number;
  isMastered: boolean;
}

export interface DictationSession {
  id: string;
  words: Word[];
  currentIndex: number;
  results: {
    wordId: string;
    english: string;
    userInput: string;
    isCorrect: boolean;
  }[];
  isFinished: boolean;
  startedAt: number;
  mode: 'all' | 'review' | 'custom'; // all: 全部, review: 错词库, custom: 随机测
}
