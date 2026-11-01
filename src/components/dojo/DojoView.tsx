import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getUniqueSolution } from 'sudoku-core';
import { DIFFICULTIES } from '../../types/sudoku';
import { DIFFICULTY_CONFIG } from '../../utils/sudokuEngine';
import { DOJO_LESSONS, DOJO_TERMS, DojoLesson } from '../../utils/dojoLessons';
import {
  DojoExample,
  cellDigitKey,
  cellLabel,
  hasDojoExamples,
  judgeEliminations,
  judgePlacement,
  loadDojoExamples,
} from '../../utils/dojoData';
import { DojoBoard, DojoReveal } from './DojoBoard';

const PROGRESS_KEY = 'zen_sudoku_dojo_v1';

/** Solved examples per lesson, keyed by the example's board so regenerated data cannot inherit marks */
type Progress = Record<string, string[]>;

const boardKey = (example: DojoExample) => example.board.join('');

function loadProgress(): Progress {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Progress = {};
    for (const [id, solved] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(solved)) result[id] = solved.filter((k): k is string => typeof k === 'string');
    }
    return result;
  } catch {
    return {};
  }
}

function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Progress is a convenience; losing it must not break the dojo
  }
}

interface DojoViewProps {
  onClose: () => void;
  /** Open this lesson directly (from a game hint) */
  initialLessonId?: string | null;
}

export default function DojoView({ onClose, initialLessonId = null }: DojoViewProps) {
  const [lessonId, setLessonId] = useState<string | null>(initialLessonId);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const lesson = DOJO_LESSONS.find((l) => l.id === lessonId) ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => saveProgress(progress), [progress]);

  // Modal behaviour: focus moves in on open, Esc closes, focus returns to the opener
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);

  const markSolved = (id: string, key: string) => {
    setProgress((prev) =>
      prev[id]?.includes(key) ? prev : { ...prev, [id]: [...(prev[id] ?? []), key] }
    );
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="解法道場"
      className="fixed inset-0 z-40 outline-none bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pt-safe pb-safe">
      <header className="w-full max-w-md mx-auto px-3 py-2 flex items-center gap-2 shrink-0">
        {lesson ? (
          <button
            type="button"
            onClick={() => setLessonId(null)}
            className="p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            aria-label="一覧に戻る"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : null}
        <h2 className="flex-1 text-base font-bold truncate">{lesson ? lesson.title : '解法道場'}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
          aria-label="道場を閉じる"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-4 pb-8">
          {lesson ? (
            <LessonPage
              key={lesson.id}
              lesson={lesson}
              solved={progress[lesson.id] ?? []}
              onSolved={(key) => markSolved(lesson.id, key)}
            />
          ) : (
            <LessonList progress={progress} onOpen={setLessonId} />
          )}
        </div>
      </div>
    </div>
  );
}

function LessonList({
  progress,
  onOpen,
}: {
  progress: Progress;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
        ナンプレの解き方を、必要になる難易度の順に並べています。解説を読んだら、実際の盤面の例題で探してみてください。
      </p>

      <details className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
        <summary className="text-xs font-semibold cursor-pointer">解説で使う言葉</summary>
        <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
          {DOJO_TERMS.map((t) => (
            <div key={t.term}>
              <dt className="inline font-semibold">{t.term}</dt>
              <dd className="inline text-slate-600 dark:text-slate-400">：{t.meaning}</dd>
            </div>
          ))}
        </dl>
      </details>

      {DIFFICULTIES.map((level) => {
        const lessons = DOJO_LESSONS.filter((l) => l.level === level);
        if (lessons.length === 0) return null;
        return (
          <section key={level} className="mt-5">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
              {DIFFICULTY_CONFIG[level].jaLabel}で使う技
            </h3>
            <div className="flex flex-col gap-1.5">
              {lessons.map((l) => {
                const solvedCount = progress[l.id]?.length ?? 0;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onOpen(l.id)}
                    className="text-left flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 active:scale-[0.99] transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold">{l.title}</span>
                        <span className="text-[10px] text-slate-400 truncate">{l.aka}</span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                        {l.summary}
                      </div>
                    </div>
                    {solvedCount > 0 ? (
                      <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        {solvedCount}
                      </span>
                    ) : null}
                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="mt-6 text-[11px] text-slate-400 leading-relaxed">
        例題は sudoku-core（MIT）の解答エンジンが実際に解いた途中の盤面から取っています。
      </p>
    </>
  );
}

function LessonPage({
  lesson,
  solved,
  onSolved,
}: {
  lesson: DojoLesson;
  solved: string[];
  onSolved: (key: string) => void;
}) {
  const [examples, setExamples] = useState<DojoExample[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!hasDojoExamples(lesson.id)) {
      setExamples([]);
      return;
    }
    loadDojoExamples(lesson.id)
      .then((list) => !cancelled && setExamples(list))
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
        setExamples([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id]);

  const example = examples?.[exampleIndex] ?? null;

  return (
    <>
      <div className="text-[11px] text-slate-400">
        {lesson.aka} ・ {DIFFICULTY_CONFIG[lesson.level].jaLabel}から
      </div>
      <p className="mt-1 text-sm font-semibold">{lesson.summary}</p>
      {lesson.body.map((p, i) => (
        <p key={i} className="mt-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
          {p}
        </p>
      ))}
      <div className="mt-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 px-3 py-2 text-[12px] leading-relaxed">
        <span className="font-semibold text-indigo-700 dark:text-indigo-300">探し方 </span>
        {lesson.tip}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-bold">
          例題{examples && examples.length > 0 ? ` ${exampleIndex + 1} / ${examples.length}` : ''}
          {example && solved.includes(boardKey(example)) ? (
            <Check className="inline w-4 h-4 ml-1 text-emerald-600 dark:text-emerald-400" />
          ) : null}
        </h3>
        {examples && examples.length > 1 ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setExampleIndex((i) => (i - 1 + examples.length) % examples.length)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800"
              aria-label="前の例題"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setExampleIndex((i) => (i + 1) % examples.length)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800"
              aria-label="次の例題"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>

      {examples === null ? (
        <p className="mt-3 text-xs text-slate-500">例題を読み込んでいます…</p>
      ) : example ? (
        <ExampleDrill
          key={`${lesson.id}-${exampleIndex}`}
          lesson={lesson}
          example={example}
          onSolved={() => onSolved(boardKey(example))}
          onNext={
            examples.length > 1 ? () => setExampleIndex((i) => (i + 1) % examples.length) : null
          }
        />
      ) : loadFailed ? (
        <p className="mt-3 text-xs text-slate-500">
          例題を読み込めませんでした。通信できる状態で開き直してください。
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          この技の例題はまだありません。問題の中で見つけにくい技なので、例題を探している途中です。
        </p>
      )}
    </>
  );
}

type Feedback = { tone: 'ok' | 'ng' | 'info'; text: string } | null;

function describeAnswer(example: DojoExample): string {
  if (example.type === 'value') {
    return example.placements.map((p) => `${cellLabel(p.index)}に ${p.digit} が入ります。`).join('');
  }
  const byDigit = new Map<number, number[]>();
  for (const e of example.eliminations) {
    byDigit.set(e.digit, [...(byDigit.get(e.digit) ?? []), e.index]);
  }
  return [...byDigit.entries()]
    .map(([digit, cells]) => `${cells.map(cellLabel).join('・')}から ${digit} を消せます。`)
    .join('');
}

function ExampleDrill({
  lesson,
  example,
  onSolved,
  onNext,
}: {
  lesson: DojoLesson;
  example: DojoExample;
  onSolved: () => void;
  onNext: (() => void) | null;
}) {
  const [reveal, setReveal] = useState<DojoReveal>('none');
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<Feedback>(null);
  const solution = useMemo(() => getUniqueSolution(example.board.map((v) => v || null)), [example]);

  const isValue = example.type === 'value';
  const done = reveal === 'answer';

  const handleCellTap = (index: number) => {
    if (done || example.board[index] !== 0) {
      setSelectedCell(null);
      return;
    }
    setSelectedCell(index);
    if (isValue) setFeedback(null);
  };

  const handleDigit = (digit: number) => {
    if (selectedCell === null) return;
    if (judgePlacement(example, selectedCell, digit)) {
      setReveal('answer');
      setFeedback({ tone: 'ok', text: `正解です。${describeAnswer(example)}` });
      onSolved();
    } else if (solution?.[selectedCell] === digit) {
      setFeedback({
        tone: 'info',
        text: `正しい数字ですが、この例題で探してほしいのは「${lesson.title}」で決まる別のマスです。`,
      });
    } else {
      setFeedback({ tone: 'ng', text: 'そのマスにその数字は入りません。' });
    }
  };

  const togglePick = (digit: number) => {
    if (selectedCell === null) return;
    const key = cellDigitKey(selectedCell, digit);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setFeedback(null);
  };

  const checkEliminations = () => {
    const result = judgeEliminations(example, picked);
    if (result.correct) {
      setReveal('answer');
      setFeedback({ tone: 'ok', text: `正解です。${describeAnswer(example)}` });
      onSolved();
      return;
    }
    const parts: string[] = [];
    if (result.extra > 0) parts.push(`選んだうち ${result.extra} 個はこの技では消せません`);
    if (result.missing > 0) parts.push(`消せる候補があと ${result.missing} 個あります`);
    setFeedback({ tone: 'ng', text: `${parts.join('。')}。` });
  };

  const showAnswer = () => {
    setReveal('answer');
    setSelectedCell(null);
    setFeedback({ tone: 'info', text: describeAnswer(example) });
  };

  const selectedCandidates = selectedCell !== null ? example.candidates[selectedCell] ?? [] : [];

  return (
    <div className="mt-2">
      <p className="text-[12px] text-slate-600 dark:text-slate-300 mb-2">
        {isValue
          ? `「${lesson.title}」で数字が決まるマスをタップし、入る数字を選んでください。`
          : `「${lesson.title}」で消せる候補を探します。マスをタップして消す候補を選び、「答え合わせ」を押してください。`}
      </p>

      <DojoBoard
        example={example}
        reveal={reveal}
        selectedCell={selectedCell}
        picked={picked}
        onCellTap={handleCellTap}
      />

      {reveal !== 'none' ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-800" />
            形を作るマス
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/60" />
            注目する行・列・ブロック
          </span>
          {done && isValue ? (
            <span className="font-bold text-amber-600 dark:text-amber-400">黄色の数字が入る数字</span>
          ) : null}
          {done && !isValue ? (
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-rose-200 dark:bg-rose-900" />
              消せる候補
            </span>
          ) : null}
        </div>
      ) : null}

      {!done && selectedCell !== null ? (
        <div className="mt-3">
          <div className="text-[11px] text-slate-500 mb-1">
            {cellLabel(selectedCell)}
            {isValue ? 'に入れる数字' : 'の候補（タップで消す候補に選ぶ）'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(isValue ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : selectedCandidates).map((d) => {
              const isPicked = !isValue && picked.has(cellDigitKey(selectedCell, d));
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => (isValue ? handleDigit(d) : togglePick(d))}
                  className={`w-9 h-10 rounded-lg border text-base font-semibold ${
                    isPicked
                      ? 'bg-rose-100 dark:bg-rose-950 border-rose-400 text-rose-600 dark:text-rose-400 line-through'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400'
                  }`}
                  aria-pressed={isValue ? undefined : isPicked}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p
          role="status"
          className={`mt-3 text-[13px] leading-relaxed rounded-xl px-3 py-2 ${
            feedback.tone === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
              : feedback.tone === 'ng'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200'
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!done && !isValue ? (
          <button
            type="button"
            onClick={checkEliminations}
            disabled={picked.size === 0}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"
          >
            答え合わせ
          </button>
        ) : null}
        {reveal === 'none' ? (
          <button
            type="button"
            onClick={() => setReveal('pattern')}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold"
          >
            形を見る
          </button>
        ) : null}
        {!done ? (
          <button
            type="button"
            onClick={showAnswer}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold"
          >
            答えを見る
          </button>
        ) : null}
        {done && onNext ? (
          <button
            type="button"
            onClick={onNext}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1"
          >
            次の例題
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
