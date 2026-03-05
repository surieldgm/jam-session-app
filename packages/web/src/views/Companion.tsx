import { useState, useEffect, useMemo } from "react";
import { usePartySocket } from "../hooks/usePartySocket";
import type { AssignedMusician, SetlistEntry } from "../types";

const INSTRUMENT_ICONS: Record<string, string> = {
  drums: "🥁",
  bass: "🎸",
  keys: "🎹",
  guitar: "🎸",
  vocals: "🎤",
  winds: "🎷",
};

function getEventId(): string {
  return `jam-${new Date().toISOString().split("T")[0]}`;
}

function CountdownTimer({ serverRemaining, isPaused }: { serverRemaining: number; isPaused: boolean }) {
  const [remaining, setRemaining] = useState(serverRemaining);

  useEffect(() => {
    setRemaining(serverRemaining);
  }, [serverRemaining]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <p className="mt-4 font-mono text-6xl font-bold tabular-nums text-(--color-text-primary) sm:text-7xl">
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </p>
  );
}

function MusicianBadge({ musician }: { musician: AssignedMusician }) {
  const icon = INSTRUMENT_ICONS[musician.instrument] ?? "🎵";
  return (
    <div className="flex items-center gap-2 rounded-lg bg-(--color-bg-hover) px-3 py-2">
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium text-(--color-text-primary)">
        {musician.alias}
      </span>
      <span className="text-xs text-(--color-text-muted)">
        {musician.instrument}
      </span>
    </div>
  );
}

function UpcomingBlock({ entry, index }: { entry: SetlistEntry; index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--color-bg-hover) text-xs font-bold text-(--color-text-muted)">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-(--color-text-primary)">
          {entry.songTitle}
        </p>
        <p className="text-xs text-(--color-text-muted)">
          {entry.assignedMusicians.map((m) => m.alias).join(", ")}
        </p>
      </div>
    </div>
  );
}

export default function Companion() {
  const eventId = useMemo(() => getEventId(), []);
  const { state, isConnected } = usePartySocket({ eventId });

  const upcoming = useMemo(() => {
    if (!state) return [];
    return state.setlistOfficial.slice(0, 3);
  }, [state]);

  if (!isConnected) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-(--color-bg-primary) px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-amber) border-t-transparent" />
        <p className="mt-4 text-sm text-(--color-text-muted)">Conectando...</p>
      </div>
    );
  }

  if (!state || !state.currentBlock) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-(--color-bg-primary) px-6">
        <div className="text-center">
          <p className="text-4xl">🎶</p>
          <p className="mt-4 text-lg text-(--color-text-secondary)">
            Esperando que inicie el evento...
          </p>
          <p className="mt-2 text-sm text-(--color-text-muted)">{eventId}</p>
        </div>

        {/* Show upcoming if setlist exists */}
        {upcoming.length > 0 && (
          <div className="mt-10 w-full max-w-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
              Pr&oacute;ximas canciones
            </h3>
            <div className="flex flex-col gap-2">
              {upcoming.map((entry, i) => (
                <UpcomingBlock key={entry.songId} entry={entry} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { currentBlock } = state;

  return (
    <div className="flex min-h-dvh flex-col bg-(--color-bg-primary) px-6 py-8">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
          En vivo
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-(--color-green)">
          <span className="h-2 w-2 rounded-full bg-(--color-green) animate-pulse" />
          Conectado
        </span>
      </div>

      {/* Current song */}
      <h1 className="text-3xl font-bold text-(--color-amber) sm:text-4xl">
        {currentBlock.songTitle}
      </h1>

      {/* Timer */}
      <CountdownTimer
        serverRemaining={state.timerRemaining ?? 420}
        isPaused={currentBlock.status === "paused"}
      />

      {/* Musicians on stage */}
      <div className="mt-8">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
          En escena
        </h3>
        <div className="flex flex-wrap gap-2">
          {currentBlock.musicians.map((m) => (
            <MusicianBadge key={m.musicianId} musician={m} />
          ))}
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            Siguiente
          </h3>
          <div className="flex flex-col gap-2">
            {upcoming.map((entry, i) => (
              <UpcomingBlock key={entry.songId} entry={entry} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
