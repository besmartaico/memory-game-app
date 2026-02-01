"use client";

import { useEffect, useMemo, useState } from "react";

type Card = {
  id: string;
  question: string;
  answer: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export default function MemoryGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/api/cards`, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = (await res.json()) as { cards: Card[]; count: number };
        if (!cancelled) setCards(data.cards || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load cards");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const questions = useMemo(() => cards.map((c) => c.question), [cards]);
  const answers = useMemo(() => cards.map((c) => c.answer), [cards]);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold tracking-tight">Memory Game</h1>
        <p className="mt-2 text-sm text-gray-600">
          Questions are on the left. Answers are on the right. They are not
          intermixed.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Questions</h2>

            <div className="mt-4 space-y-3">
              {loading && <div className="text-sm text-gray-600">Loading…</div>}
              {error && (
                <div className="text-sm text-red-600">
                  {error}
                  <div className="mt-1 text-xs text-gray-500">
                    API_BASE: {API_BASE}
                  </div>
                </div>
              )}
              {!loading && !error && questions.length === 0 && (
                <div className="text-sm text-gray-600">No cards found.</div>
              )}

              {!loading &&
                !error &&
                questions.map((q, idx) => (
                  <div
                    key={`q-${idx}`}
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800"
                  >
                    {q || <span className="text-gray-400">(blank)</span>}
                  </div>
                ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Answers</h2>

            <div className="mt-4 space-y-3">
              {loading && <div className="text-sm text-gray-600">Loading…</div>}
              {error && (
                <div className="text-sm text-red-600">
                  {error}
                  <div className="mt-1 text-xs text-gray-500">
                    API_BASE: {API_BASE}
                  </div>
                </div>
              )}
              {!loading && !error && answers.length === 0 && (
                <div className="text-sm text-gray-600">No cards found.</div>
              )}

              {!loading &&
                !error &&
                answers.map((a, idx) => (
                  <div
                    key={`a-${idx}`}
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800"
                  >
                    {a || <span className="text-gray-400">(blank)</span>}
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
