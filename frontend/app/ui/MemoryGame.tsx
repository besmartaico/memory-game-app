"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type CardRow = {
  id: string;
  question: string;
  answer: string;
};

type Team = {
  name: string;
  color: string; // hex
  score: number;
};

type Side = "Q" | "A";

type Tile = {
  key: string; // unique per tile instance (Q-idx or A-idx)
  id: string; // shared match id across Q and A
  side: Side;
  text: string;
  index: number;
};

function clampHexColor(input: string) {
  const s = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return "#7c3aed"; // fallback purple
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function lighten(hex: string, amt = 0.85) {
  // amt 0..1 => closer to white
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r + (255 - r) * amt);
  const ng = Math.round(g + (255 - g) * amt);
  const nb = Math.round(b + (255 - b) * amt);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export default function MemoryGame() {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000";

  // --- setup / pre-game ---
  const [setupTeam1Name, setSetupTeam1Name] = useState("Team 1");
  const [setupTeam2Name, setSetupTeam2Name] = useState("Team 2");
  const [setupTeam1Color, setSetupTeam1Color] = useState("#22c55e"); // green
  const [setupTeam2Color, setSetupTeam2Color] = useState("#7c3aed"); // purple
  const [setupFirst, setSetupFirst] = useState<0 | 1>(0);
  const [isGameStarted, setIsGameStarted] = useState(false);

  // --- data ---
  const [rows, setRows] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // --- game state ---
  const [teams, setTeams] = useState<Team[]>([
    { name: "Team 1", color: "#22c55e", score: 0 },
    { name: "Team 2", color: "#7c3aed", score: 0 },
  ]);
  const [activeTeam, setActiveTeam] = useState<0 | 1>(0);

  const [selectedQ, setSelectedQ] = useState<Tile | null>(null);
  const [selectedA, setSelectedA] = useState<Tile | null>(null);

  const [matchedKeys, setMatchedKeys] = useState<Map<string, number>>(
    () => new Map()
  ); // tile.key -> teamIndex

  // mismatch countdown (5s), pausable if zoom overlay is open
  const [mismatchRemainingMs, setMismatchRemainingMs] = useState<number | null>(
    null
  );
  const mismatchIntervalRef = useRef<number | null>(null);
  const mismatchStartRef = useRef<number | null>(null);
  const mismatchDurationRef = useRef<number>(5000);

  // zoom overlay
  const [zoomed, setZoomed] = useState<Tile | null>(null);

  // Build 15 Q tiles and 15 A tiles (shuffle each column independently)
  const { qTiles, aTiles } = useMemo(() => {
    const take = rows.slice(0, 15);
    const qs: Tile[] = take.map((r, idx) => ({
      key: `Q-${idx}`,
      id: String(r.id),
      side: "Q",
      text: r.question ?? "",
      index: idx,
    }));
    const as: Tile[] = take.map((r, idx) => ({
      key: `A-${idx}`,
      id: String(r.id),
      side: "A",
      text: r.answer ?? "",
      index: idx,
    }));

    return {
      qTiles: shuffle(qs),
      aTiles: shuffle(as),
    };
  }, [rows]);

  const gameReady = rows.length >= 15;

  function clearMismatchTimer() {
    if (mismatchIntervalRef.current) {
      window.clearInterval(mismatchIntervalRef.current);
      mismatchIntervalRef.current = null;
    }
    mismatchStartRef.current = null;
    setMismatchRemainingMs(null);
  }

  function startMismatchTimer(ms: number) {
    clearMismatchTimer();
    mismatchDurationRef.current = ms;
    mismatchStartRef.current = Date.now();
    setMismatchRemainingMs(ms);

    mismatchIntervalRef.current = window.setInterval(() => {
      // Pause if zoom overlay is open
      if (zoomed) return;

      const start = mismatchStartRef.current ?? Date.now();
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, mismatchDurationRef.current - elapsed);
      setMismatchRemainingMs(remaining);

      if (remaining <= 0) {
        clearMismatchTimer();
        setSelectedQ(null);
        setSelectedA(null);
      }
    }, 100);
  }

  // If zoom is opened during mismatch, pause. When zoom closes, resume with remaining.
  useEffect(() => {
    // If zoom opened, just stop ticking time (interval still runs but early returns).
    // When zoom closes, we "resume" by resetting the start time based on remaining.
    if (!zoomed && mismatchRemainingMs !== null && mismatchRemainingMs > 0) {
      // resume: set new start time so remaining continues accurately
      mismatchStartRef.current = Date.now();
      mismatchDurationRef.current = mismatchRemainingMs;
    }
  }, [zoomed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchCards() {
    setLoading(true);
    setFetchErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/cards`, { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fetch failed (${res.status}): ${text}`);
      }
      const data = await res.json();
      const cards: CardRow[] = data.cards ?? [];
      setRows(cards);
    } catch (e: any) {
      setFetchErr(e?.message ?? "Failed to fetch");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Load cards on first render
  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startGame() {
    const t1 = {
      name: setupTeam1Name.trim() || "Team 1",
      color: clampHexColor(setupTeam1Color),
      score: 0,
    };
    const t2 = {
      name: setupTeam2Name.trim() || "Team 2",
      color: clampHexColor(setupTeam2Color),
      score: 0,
    };

    setTeams([t1, t2]);
    setActiveTeam(setupFirst);
    setMatchedKeys(new Map());
    setSelectedQ(null);
    setSelectedA(null);
    setZoomed(null);
    clearMismatchTimer();
    setIsGameStarted(true);
  }

  function resetGame() {
    setIsGameStarted(false);
    setSelectedQ(null);
    setSelectedA(null);
    setZoomed(null);
    clearMismatchTimer();
    setMatchedKeys(new Map());
    setTeams((prev) => prev.map((t) => ({ ...t, score: 0 })));
    setActiveTeam(0);
  }

  function isTileMatched(tile: Tile) {
    return matchedKeys.has(tile.key);
  }

  function isTileFaceUp(tile: Tile) {
    if (isTileMatched(tile)) return true;
    if (tile.side === "Q" && selectedQ?.key === tile.key) return true;
    if (tile.side === "A" && selectedA?.key === tile.key) return true;
    return false;
  }

  function tileOwnerTeam(tile: Tile): number | null {
    const v = matchedKeys.get(tile.key);
    return typeof v === "number" ? v : null;
  }

  function onTileClick(tile: Tile) {
    if (!isGameStarted) return;

    // If tile is already matched: allow zoom on second click (or first click if you want)
    if (isTileMatched(tile)) {
      if (zoomed?.key === tile.key) setZoomed(null);
      else setZoomed(tile);
      return;
    }

    // If mismatch countdown is running and both are selected, ignore new picks;
    // but allow zooming the currently selected card(s)
    const mismatchActive =
      mismatchRemainingMs !== null && mismatchRemainingMs > 0;
    if (mismatchActive) {
      const isCurrentlySelected =
        (tile.side === "Q" && selectedQ?.key === tile.key) ||
        (tile.side === "A" && selectedA?.key === tile.key);
      if (isCurrentlySelected) {
        if (zoomed?.key === tile.key) setZoomed(null);
        else setZoomed(tile);
      }
      return;
    }

    // If you click the same face-up tile again -> zoom
    const isSelectedAlready =
      (tile.side === "Q" && selectedQ?.key === tile.key) ||
      (tile.side === "A" && selectedA?.key === tile.key);

    if (isSelectedAlready) {
      if (zoomed?.key === tile.key) setZoomed(null);
      else setZoomed(tile);
      return;
    }

    // Normal selection rules: one Q and one A at a time
    if (tile.side === "Q") {
      if (selectedQ) return; // already have a question selected
      setSelectedQ(tile);
    } else {
      if (selectedA) return; // already have an answer selected
      setSelectedA(tile);
    }
  }

  // When both selected -> check match
  useEffect(() => {
    if (!isGameStarted) return;
    if (!selectedQ || !selectedA) return;

    if (selectedQ.id === selectedA.id) {
      // MATCH: mark both tiles owned by active team
      setMatchedKeys((prev) => {
        const next = new Map(prev);
        next.set(selectedQ.key, activeTeam);
        next.set(selectedA.key, activeTeam);
        return next;
      });

      setTeams((prev) => {
        const next = [...prev];
        next[activeTeam] = { ...next[activeTeam], score: next[activeTeam].score + 1 };
        return next;
      });

      // same team goes again
      window.setTimeout(() => {
        setSelectedQ(null);
        setSelectedA(null);
        setZoomed(null);
      }, 450);
    } else {
      // NO MATCH: keep face-up for 5 seconds, then flip back (unless zoom pauses)
      startMismatchTimer(5000);

      // switch turn AFTER they flip back (so scoreboard feels fair)
      // But if you want immediate switch, move this above startMismatchTimer.
      window.setTimeout(() => {
        // If mismatch got cleared early for some reason, don't switch.
        setActiveTeam((t) => (t === 0 ? 1 : 0));
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQ, selectedA]);

  const activeTeamObj = teams[activeTeam];
  const activeBarBg = lighten(activeTeamObj.color, 0.88);

  function CardTile({ tile }: { tile: Tile }) {
    const faceUp = isTileFaceUp(tile);
    const owner = tileOwnerTeam(tile);
    const ownerColor = owner !== null ? teams[owner].color : null;

    const borderColor = ownerColor ?? "#e5e7eb";
    const backBg = "#f8fafc"; // subtle
    const frontBg = ownerColor ? lighten(ownerColor, 0.9) : "white";

    return (
      <button
        type="button"
        onClick={() => onTileClick(tile)}
        className="relative w-full h-20 sm:h-24 rounded-xl focus:outline-none"
        aria-label={`${tile.side === "Q" ? "Question" : "Answer"} card`}
      >
        <div
          className={[
            "relative w-full h-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d]",
            faceUp ? "[transform:rotateY(180deg)]" : "",
          ].join(" ")}
        >
          {/* BACK (face down) */}
          <div
            className="absolute inset-0 rounded-xl border shadow-sm [backface-visibility:hidden]"
            style={{ backgroundColor: backBg, borderColor }}
          >
            {/* intentionally blank */}
          </div>

          {/* FRONT (face up) */}
          <div
            className="absolute inset-0 rounded-xl border shadow-sm p-2 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{ backgroundColor: frontBg, borderColor }}
          >
            <div className="h-full w-full overflow-hidden">
              <div className="text-xs sm:text-sm font-medium leading-snug whitespace-pre-wrap">
                {tile.text}
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Memory Game</h1>
          <p className="text-gray-600 mt-2">
            Questions are on the left. Answers are on the right. They are not intermixed.
          </p>
        </div>

        {isGameStarted && (
          <button
            type="button"
            onClick={resetGame}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </div>

      {/* Setup Panel */}
      {!isGameStarted && (
        <div className="border rounded-2xl p-5 mb-8 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team 1 Name</label>
              <input
                value={setupTeam1Name}
                onChange={(e) => setSetupTeam1Name(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Team 1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Team 1 Color</label>
              <input
                type="color"
                value={setupTeam1Color}
                onChange={(e) => setSetupTeam1Color(e.target.value)}
                className="w-full h-10 border rounded-lg px-2 py-1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Who goes first?</label>
              <select
                value={String(setupFirst)}
                onChange={(e) => setSetupFirst(e.target.value === "0" ? 0 : 1)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="0">Team 1</option>
                <option value="1">Team 2</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Team 2 Name</label>
              <input
                value={setupTeam2Name}
                onChange={(e) => setSetupTeam2Name(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Team 2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Team 2 Color</label>
              <input
                type="color"
                value={setupTeam2Color}
                onChange={(e) => setSetupTeam2Color(e.target.value)}
                className="w-full h-10 border rounded-lg px-2 py-1"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={fetchCards}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
              >
                Refresh Cards
              </button>

              <button
                type="button"
                onClick={startGame}
                disabled={!gameReady || loading}
                className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
                style={{ backgroundColor: "#111827" }}
              >
                Start Game
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <div>
              <span className="font-mono text-xs">API_BASE:</span>{" "}
              <span className="font-mono text-xs">{API_BASE}</span>
            </div>
            {loading && <div className="mt-1">Loading cards…</div>}
            {fetchErr && (
              <div className="mt-1 text-red-600">
                Failed to fetch ({fetchErr})
              </div>
            )}
            {!loading && !fetchErr && rows.length > 0 && (
              <div className="mt-1">Loaded {rows.length} rows.</div>
            )}
            {!loading && !fetchErr && rows.length > 0 && rows.length < 15 && (
              <div className="mt-1 text-red-600">
                Need at least 15 rows in Google Sheets. Currently: {rows.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scoreboard */}
      {isGameStarted && (
        <div
          className="rounded-2xl border p-4 mb-8"
          style={{ backgroundColor: activeBarBg, borderColor: "#e5e7eb" }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activeTeamObj.color }}
              />
              <div className="text-sm text-gray-700">
                Turn:{" "}
                <span className="font-semibold">{activeTeamObj.name}</span>
              </div>

              {mismatchRemainingMs !== null && mismatchRemainingMs > 0 && (
                <div className="text-xs text-gray-600">
                  Flipping back in{" "}
                  <span className="font-mono">
                    {Math.ceil(mismatchRemainingMs / 1000)}s
                  </span>
                  {zoomed ? " (paused)" : ""}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              {teams.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border px-4 py-2 bg-white shadow-sm"
                  style={{ borderColor: lighten(t.color, 0.5) }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <div className="text-sm font-semibold">{t.name}</div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Points: <span className="font-mono">{t.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Boards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Questions */}
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Questions</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {qTiles.map((t) => (
              <CardTile key={t.key} tile={t} />
            ))}
          </div>
        </div>

        {/* Answers */}
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Answers</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {aTiles.map((t) => (
              <CardTile key={t.key} tile={t} />
            ))}
          </div>
        </div>
      </div>

      {/* Zoom Overlay */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
          onClick={() => setZoomed(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-gray-500">
                  {zoomed.side === "Q" ? "Question" : "Answer"}
                </div>
                <div className="text-2xl font-semibold mt-1">Card</div>
              </div>
              <button
                type="button"
                onClick={() => setZoomed(null)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 whitespace-pre-wrap text-lg leading-relaxed">
              {zoomed.text}
            </div>

            <div className="mt-5 text-xs text-gray-500">
              Tip: click the same flipped card again to open/close this view.
              {mismatchRemainingMs !== null && mismatchRemainingMs > 0
                ? " (Mismatch timer is paused while this is open.)"
                : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
