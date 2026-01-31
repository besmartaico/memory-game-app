"use client";

import { useMemo, useState } from "react";

type Card = {
  id: string;
  question: string;
  answer: string;
};

const SAMPLE_CARDS: Card[] = [
  { id: "1", question: "Capital of Utah?", answer: "Salt Lake City" },
  { id: "2", question: "2 + 2", answer: "4" },
  { id: "3", question: "Largest planet", answer: "Jupiter" },
  { id: "4", question: "Primary color mixing: red + blue", answer: "Purple" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryGame() {
  // We keep Qs fixed order, and shuffle As so they’re not aligned.
  const questions = useMemo(
    () => SAMPLE_CARDS.map((c) => ({ id: c.id, text: c.question })),
    []
  );

  const answers = useMemo(
    () => shuffle(SAMPLE_CARDS.map((c) => ({ id: c.id, text: c.answer }))),
    []
  );

  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());

  // minimal match behavior (so the UI feels “real”)
  function tryMatch(qId: string, aId: string) {
    if (qId === aId) {
      setMatched((prev) => new Set(prev).add(qId));
    }
    setSelectedQ(null);
    setSelectedA(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Questions */}
      <div className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Questions</h2>
        <div className="mt-3 space-y-2">
          {questions.map((q) => {
            const isMatched = matched.has(q.id);
            const isSelected = selectedQ === q.id;

            return (
              <button
                key={q.id}
                type="button"
                disabled={isMatched}
                onClick={() => {
                  setSelectedQ(q.id);
                  if (selectedA) tryMatch(q.id, selectedA);
                }}
                className={[
                  "w-full rounded-lg border px-3 py-3 text-left text-sm transition",
                  isMatched
                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                    : "hover:bg-gray-50",
                  isSelected ? "ring-2 ring-black" : "",
                ].join(" ")}
              >
                {q.text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Answers */}
      <div className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Answers</h2>
        <div className="mt-3 space-y-2">
          {answers.map((a) => {
            const isMatched = matched.has(a.id);
            const isSelected = selectedA === a.id;

            return (
              <button
                key={a.id}
                type="button"
                disabled={isMatched}
                onClick={() => {
                  setSelectedA(a.id);
                  if (selectedQ) tryMatch(selectedQ, a.id);
                }}
                className={[
                  "w-full rounded-lg border px-3 py-3 text-left text-sm transition",
                  isMatched
                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                    : "hover:bg-gray-50",
                  isSelected ? "ring-2 ring-black" : "",
                ].join(" ")}
              >
                {a.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
