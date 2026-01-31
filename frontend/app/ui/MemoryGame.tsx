"use client";

import { useEffect, useMemo, useState } from "react";

type Card = {
  id: string;
  question: string;
  answer: string;
};

type ApiResponse = {
  count: number;
  cards: Card[];
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryGame() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // selections
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [selectedA, setSelectedA] = useState<string | null>(null);

  // matched ids
  const [matched, setMatched] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${apiBase}/api/cards`, { cache: "no-store" });
        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = (await res.json()) as ApiResponse;

        if (!cancelled) {
          setCards(data.cards || []);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load cards");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const questions = useMemo(() => {
    return cards.map((c) => ({ id: c.id, text: c.question }));
  }, [cards]);

  const answers = useMemo(() => {
    return shuffle(cards.map((c) => ({ id: c.id, text: c.answer })));
  }, [cards]);

  // check match when both selected
  useEffect(() => {
    if (!selectedQ || !selectedA) return;

    if (selectedQ === selectedA) {
      setMatched((prev) => new Set(prev).add(selectedQ));
    }

    const t = setTimeout(() => {
      setSelectedQ(null);
      setSelectedA(null);
    }, 650);

    return () => clearTimeout(t);
  }, [selectedQ, selectedA]);

  if (loading) return <div className="text-gray-600">Loading cards…</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!cards.length) return <div className="text-gray-600">No cards found in the sheet.</div>;

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
                onClick={() => setSelectedQ(q.id)}
                className={[
                  "w-full rounded-lg border px-3 py-3 text-left text-sm transition",
                  isMatched ? "cursor-not-allowed bg-gray-100 text-gray-400" : "hover:bg-gray-50",
                  isSelected ? "ring-2 ring-black" : "",
                  selectedQ && !isSelected ? "opacity-80" : "",
                ].join(" ")}
              >
                {q.text || <span className="italic text-gray-400">(empty question)</span>}
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
                onClick={() => setSelectedA(a.id)}
                className={[
                  "w-full rounded-lg border px-3 py-3 text-left text-sm transition",
                  isMatched ? "cursor-not-allowed bg-gray-100 text-gray-400" : "hover:bg-gray-50",
                  isSelected ? "ring-2 ring-black" : "",
                  selectedA && !isSelected ? "opacity-80" : "",
                ].join(" ")}
              >
                {a.text || <span className="italic text-gray-400">(empty answer)</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
