"use client";

import { useEffect, useMemo, useState } from "react";

type Card = {
  id: string;
  question: string;
  answer: string;
};

type Team = {
  name: string;
  color: string; // hex like #22c55e
  score: number;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function MemoryGame() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Game setup
  const [started, setStarted] = useState(false);
  const [teams, setTeams] = useState<Team[]>([
    { name: "Team 1", color: "#22c55e", score: 0 },
    { name: "Team 2", color: "#a855f7", score: 0 },
  ]);
  const [startingTeamIndex, setStartingTeamIndex] = useState(0);

  // Round state (15 pairs)
  const [questionOrder, setQuestionOrder] = useState<Card[]>([]);
  const [answerOrder, setAnswerOrder] = useState<Card[]>([]);

  // Reveal + matching state
  const [revealedQuestionId, setRevealedQuestionId] = useState<string | null>(
    null
  );
  const [revealedAnswerId, setRevealedAnswerId] = useState<string | null>(null);

  // matched IDs -> team index that won the match
  const [matchedById, setMatchedById] = useState<Record<string, number>>({});

  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [busy, setBusy] = useState(false); // prevent clicks during flip-back delay

  // Fetch cards once
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
        if (!cancelled) setAllCards(data.cards || []);
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

  const canStart = useMemo(() => {
    const t1 = teams[0]?.name?.trim();
    const t2 = teams[1]?.name?.trim();
    return Boolean(t1 && t2);
  }, [teams]);

  function startGame() {
    const usable = allCards.filter(
      (c) => c?.id && c?.question != null && c?.answer != null
    );

    if (usable.length < 15) {
      setError(
        `Not enough rows in the sheet. Need at least 15, found ${usable.length}.`
      );
      return;
    }

    const selected = shuffle(usable).slice(0, 15);
    setQuestionOrder(shuffle(selected));
    setAnswerOrder(shuffle(selected));

    // Reset match/reveal/score/turn
    setMatchedById({});
    setRevealedQuestionId(null);
    setRevealedAnswerId(null);
    setBusy(false);

    setTeams((prev) => prev.map((t) => ({ ...t, score: 0 })));
    setCurrentTeamIndex(startingTeamIndex);

    setStarted(true);
  }

  function resetToSetup() {
    setStarted(false);
    setQuestionOrder([]);
    setAnswerOrder([]);
    setMatchedById({});
    setRevealedQuestionId(null);
    setRevealedAnswerId(null);
    setBusy(false);
    setTeams((prev) => prev.map((t) => ({ ...t, score: 0 })));
    setCurrentTeamIndex(startingTeamIndex);
  }

  function newRoundSameTeams() {
    setTeams((prev) => prev.map((t) => ({ ...t, score: 0 })));
    setCurrentTeamIndex(startingTeamIndex);
    setMatchedById({});
    setRevealedQuestionId(null);
    setRevealedAnswerId(null);
    setBusy(false);

    const usable = allCards.filter(
      (c) => c?.id && c?.question != null && c?.answer != null
    );
    if (usable.length < 15) {
      setError(
        `Not enough rows in the sheet. Need at least 15, found ${usable.length}.`
      );
      return;
    }

    const selected = shuffle(usable).slice(0, 15);
    setQuestionOrder(shuffle(selected));
    setAnswerOrder(shuffle(selected));
  }

  function handleQuestionClick(card: Card) {
    if (!started || busy) return;
    if (matchedById[card.id] !== undefined) return;
    if (revealedQuestionId === card.id) return;
    setRevealedQuestionId(card.id);
  }

  function handleAnswerClick(card: Card) {
    if (!started || busy) return;
    if (matchedById[card.id] !== undefined) return;
    if (revealedAnswerId === card.id) return;
    setRevealedAnswerId(card.id);
  }

  // When both are revealed, evaluate match
  useEffect(() => {
    if (!started) return;
    if (!revealedQuestionId || !revealedAnswerId) return;

    const qId = revealedQuestionId;
    const aId = revealedAnswerId;
    const isMatch = qId === aId;

    if (isMatch) {
      setMatchedById((prev) => ({ ...prev, [qId]: currentTeamIndex }));
      setTeams((prev) =>
        prev.map((t, idx) =>
          idx === currentTeamIndex ? { ...t, score: t.score + 1 } : t
        )
      );
      setRevealedQuestionId(null);
      setRevealedAnswerId(null);
      return;
    }

    // Not a match: keep them open for 5 seconds, then flip back + switch turn
    setBusy(true);
    const timer = setTimeout(() => {
      setRevealedQuestionId(null);
      setRevealedAnswerId(null);
      setCurrentTeamIndex((prev) => (prev === 0 ? 1 : 0));
      setBusy(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [revealedQuestionId, revealedAnswerId, started, currentTeamIndex]);

  const totalMatches = Object.keys(matchedById).length;
  const gameComplete = started && totalMatches === 15;

  const currentTeam = teams[currentTeamIndex];

  function cardStyle(teamColor: string | null, isRevealed: boolean) {
    return {
      borderColor: teamColor ? teamColor : isRevealed ? "#9ca3af" : "#d1d5db",
      backgroundColor: teamColor
        ? hexToRgba(teamColor, 0.18)
        : isRevealed
        ? "rgba(0,0,0,0.03)"
        : "rgba(0,0,0,0.02)",
    } as React.CSSProperties;
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Memory Game</h1>
          <p className="text-sm text-gray-600">
            Questions are on the left. Answers are on the right. They are not
            intermixed.
          </p>
        </div>

        {loading && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            Loading cards…
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <div className="mt-1 text-xs text-gray-600">API_BASE: {API_BASE}</div>
          </div>
        )}

        {/* Setup Panel */}
        {!loading && !started && (
          <section className="mt-6 rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Game Setup</h2>
              </div>

              <div className="flex gap-2">
                <button
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setTeams([
                      { name: "Team 1", color: "#22c55e", score: 0 },
                      { name: "Team 2", color: "#a855f7", score: 0 },
                    ]);
                    setStartingTeamIndex(0);
                  }}
                >
                  Reset Defaults
                </button>

                <button
                  className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canStart || allCards.length < 15}
                  onClick={startGame}
                >
                  Start Game
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Team 1 */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Team 1</h3>
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: teams[0].color }}
                  />
                </div>

                <label className="mt-3 block text-xs font-medium text-gray-700">
                  Name
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={teams[0].name}
                  onChange={(e) =>
                    setTeams((prev) => [
                      { ...prev[0], name: e.target.value },
                      prev[1],
                    ])
                  }
                />

                <label className="mt-3 block text-xs font-medium text-gray-700">
                  Color
                </label>
                <input
                  type="color"
                  className="mt-1 h-10 w-full cursor-pointer rounded-md border border-gray-300 p-1"
                  value={teams[0].color}
                  onChange={(e) =>
                    setTeams((prev) => [
                      { ...prev[0], color: e.target.value },
                      prev[1],
                    ])
                  }
                />
              </div>

              {/* Team 2 */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Team 2</h3>
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: teams[1].color }}
                  />
                </div>

                <label className="mt-3 block text-xs font-medium text-gray-700">
                  Name
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={teams[1].name}
                  onChange={(e) =>
                    setTeams((prev) => [
                      prev[0],
                      { ...prev[1], name: e.target.value },
                    ])
                  }
                />

                <label className="mt-3 block text-xs font-medium text-gray-700">
                  Color
                </label>
                <input
                  type="color"
                  className="mt-1 h-10 w-full cursor-pointer rounded-md border border-gray-300 p-1"
                  value={teams[1].color}
                  onChange={(e) =>
                    setTeams((prev) => [
                      prev[0],
                      { ...prev[1], color: e.target.value },
                    ])
                  }
                />
              </div>

              {/* Starting team */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold">Who goes first?</h3>

                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="firstTeam"
                      checked={startingTeamIndex === 0}
                      onChange={() => setStartingTeamIndex(0)}
                    />
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: teams[0].color }}
                      />
                      {teams[0].name || "Team 1"}
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="firstTeam"
                      checked={startingTeamIndex === 1}
                      onChange={() => setStartingTeamIndex(1)}
                    />
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: teams[1].color }}
                      />
                      {teams[1].name || "Team 2"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Game UI */}
        {!loading && started && (
          <>
            {/* Scoreboard */}
            <section className="mt-6 rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-gray-600">Current turn</div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: currentTeam.color }}
                    />
                    <span className="text-lg font-semibold">
                      {currentTeam.name}
                    </span>
                    {busy && (
                      <span className="text-xs text-gray-500">(waiting…)</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: teams[0].color }}
                      />
                      <span className="text-sm font-medium">
                        {teams[0].name}:{" "}
                        <span className="font-bold">{teams[0].score}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: teams[1].color }}
                      />
                      <span className="text-sm font-medium">
                        {teams[1].name}:{" "}
                        <span className="font-bold">{teams[1].score}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 md:pl-4">
                    <button
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={newRoundSameTeams}
                    >
                      New Round
                    </button>

                    <button
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={resetToSetup}
                    >
                      Change Teams
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Matches found: {totalMatches} / 15
              </div>

              {gameComplete && (
                <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                  <span className="font-semibold">Round complete!</span>
                </div>
              )}
            </section>

            {/* Board (3x5 per side) */}
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Questions */}
              <section className="rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Questions</h2>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {questionOrder.map((c) => {
                    const matchedTeamIndex = matchedById[c.id];
                    const isMatched = matchedTeamIndex !== undefined;
                    const isRevealed = revealedQuestionId === c.id || isMatched;

                    const teamColor = isMatched
                      ? teams[matchedTeamIndex].color
                      : null;

                    // When revealed (but not matched), expand to full row to fit text.
                    const expand =
                      revealedQuestionId === c.id && matchedById[c.id] === undefined;

                    return (
                      <button
                        key={`q-${c.id}`}
                        onClick={() => handleQuestionClick(c)}
                        disabled={busy || isMatched}
                        className={[
                          "rounded-md border text-left text-sm transition disabled:cursor-not-allowed",
                          "h-20 px-3 py-2", // default compact size
                          "hover:shadow-sm",
                          expand ? "col-span-3 h-auto p-4 shadow-md z-10" : "",
                        ].join(" ")}
                        style={cardStyle(teamColor, isRevealed)}
                        aria-label={isRevealed ? `Question: ${c.question}` : "Face down"}
                        title={
                          isMatched
                            ? `Matched by ${teams[matchedTeamIndex].name}`
                            : undefined
                        }
                      >
                        {isRevealed ? (
                          <div className="text-gray-900 whitespace-pre-wrap break-words">
                            {c.question}
                          </div>
                        ) : (
                          // Face down = blank
                          <div className="h-full w-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Answers */}
              <section className="rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Answers</h2>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {answerOrder.map((c) => {
                    const matchedTeamIndex = matchedById[c.id];
                    const isMatched = matchedTeamIndex !== undefined;
                    const isRevealed = revealedAnswerId === c.id || isMatched;

                    const teamColor = isMatched
                      ? teams[matchedTeamIndex].color
                      : null;

                    const expand =
                      revealedAnswerId === c.id && matchedById[c.id] === undefined;

                    return (
                      <button
                        key={`a-${c.id}`}
                        onClick={() => handleAnswerClick(c)}
                        disabled={busy || isMatched}
                        className={[
                          "rounded-md border text-left text-sm transition disabled:cursor-not-allowed",
                          "h-20 px-3 py-2",
                          "hover:shadow-sm",
                          expand ? "col-span-3 h-auto p-4 shadow-md z-10" : "",
                        ].join(" ")}
                        style={cardStyle(teamColor, isRevealed)}
                        aria-label={isRevealed ? `Answer: ${c.answer}` : "Face down"}
                        title={
                          isMatched
                            ? `Matched by ${teams[matchedTeamIndex].name}`
                            : undefined
                        }
                      >
                        {isRevealed ? (
                          <div className="text-gray-900 whitespace-pre-wrap break-words">
                            {c.answer}
                          </div>
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="mt-4 text-xs text-gray-400">API_BASE: {API_BASE}</div>
          </>
        )}
      </div>
    </main>
  );
}
