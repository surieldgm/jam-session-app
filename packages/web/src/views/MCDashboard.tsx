import { useState, useEffect, useMemo, useCallback } from "react";
import { usePartySocket } from "../hooks/usePartySocket";
import { useSessionIdentity } from "../hooks/useSessionIdentity";
import type { Instrument, AssignedMusician, Musician, SetlistEntry, Song, Genre } from "../types";

function getEventId(): string {
  return `jam-${new Date().toISOString().split("T")[0]}`;
}

const INSTRUMENT_ICONS: Record<string, string> = {
  drums: "🥁",
  bass: "🎸",
  keys: "🎹",
  guitar: "🎸",
  vocals: "🎤",
  winds: "🎷",
};

const INSTRUMENT_ORDER: Instrument[] = ["drums", "bass", "keys", "guitar", "vocals", "winds"];

type TabId = "live" | "queue" | "setlist" | "catalog" | "export";

const TABS: { id: TabId; label: string }[] = [
  { id: "live", label: "En Vivo" },
  { id: "queue", label: "Cola" },
  { id: "setlist", label: "Setlist" },
  { id: "catalog", label: "Catalogo" },
  { id: "export", label: "Exportar" },
];

// ─── PIN Gate ──────────────────────────────────────────────────────
function PinGate({ onAuth }: { onAuth: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (pin.length < 4) {
        setError(true);
        return;
      }
      setError(false);
      onAuth(pin);
    },
    [pin, onAuth]
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-(--color-bg-primary) px-6">
      <h1 className="mb-2 text-2xl font-bold text-(--color-amber)">Acceso MC</h1>
      <p className="mb-8 text-sm text-(--color-text-muted)">
        Ingresa el PIN del evento
      </p>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="PIN"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ""));
            setError(false);
          }}
          className={`w-full rounded-lg border bg-(--color-bg-card) px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none ${
            error
              ? "border-(--color-red)"
              : "border-(--color-bg-hover) focus:border-(--color-amber)"
          }`}
        />
        {error && (
          <p className="text-center text-xs text-(--color-red)">PIN invalido</p>
        )}
        <button
          type="submit"
          className="min-h-12 rounded-xl bg-(--color-amber) px-6 py-3 text-lg font-bold text-(--color-bg-primary) transition-colors hover:bg-(--color-amber-dark)"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}

// ─── Timer Component ───────────────────────────────────────────────
function Timer({
  serverRemaining,
  isPaused,
  onAction,
}: {
  serverRemaining: number;
  isPaused: boolean;
  onAction: (action: "start" | "pause" | "reset") => void;
}) {
  const [remaining, setRemaining] = useState(serverRemaining);

  // Sync with server-broadcast remaining
  useEffect(() => {
    setRemaining(serverRemaining);
  }, [serverRemaining]);

  // Client-side countdown interval (only while playing)
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
    <div className="flex flex-col items-center gap-4">
      <p className="font-mono text-5xl font-bold tabular-nums text-(--color-text-primary)">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </p>
      {isPaused && (
        <span className="text-xs font-medium uppercase tracking-wider text-(--color-amber)">
          En pausa
        </span>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onAction("start")}
          className="rounded-lg bg-(--color-green)/20 px-4 py-2 text-sm font-medium text-(--color-green) hover:bg-(--color-green)/30"
        >
          {isPaused ? "Reanudar" : "Play"}
        </button>
        <button
          onClick={() => onAction("pause")}
          className="rounded-lg bg-(--color-amber)/20 px-4 py-2 text-sm font-medium text-(--color-amber) hover:bg-(--color-amber)/30"
        >
          Pausa
        </button>
        <button
          onClick={() => onAction("reset")}
          className="rounded-lg bg-(--color-red)/20 px-4 py-2 text-sm font-medium text-(--color-red) hover:bg-(--color-red)/30"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ─── Tab: En Vivo ──────────────────────────────────────────────────
function TabLive({
  currentBlock,
  timerRemaining,
  onTimerAction,
}: {
  currentBlock: {
    songTitle: string;
    musicians: AssignedMusician[];
    startTime: number;
    status: "playing" | "paused";
  } | null;
  timerRemaining: number | null;
  onTimerAction: (action: "start" | "pause" | "reset") => void;
}) {
  if (!currentBlock) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-4xl">🎶</p>
        <p className="mt-4 text-lg text-(--color-text-secondary)">
          Ningun bloque activo
        </p>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Confirma un bloque del setlist para iniciar
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-(--color-bg-hover) bg-(--color-bg-card) p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
          Tocando ahora
        </p>
        <h2 className="text-2xl font-bold text-(--color-amber)">
          {currentBlock.songTitle}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {currentBlock.musicians.map((m) => (
            <span
              key={m.musicianId}
              className="inline-flex items-center gap-1.5 rounded-md bg-(--color-bg-hover) px-2.5 py-1 text-xs text-(--color-text-secondary)"
            >
              {INSTRUMENT_ICONS[m.instrument] ?? "🎵"} {m.alias}
            </span>
          ))}
        </div>
      </div>

      <Timer
        serverRemaining={timerRemaining ?? 420}
        isPaused={currentBlock.status === "paused"}
        onAction={onTimerAction}
      />
    </div>
  );
}

// ─── Tab: Cola ─────────────────────────────────────────────────────
function TabQueue({
  queue,
  onRemove,
  onEmergencyAdd,
}: {
  queue: Musician[];
  onRemove: (musicianId: string) => void;
  onEmergencyAdd: (alias: string, instrument: Instrument) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addAlias, setAddAlias] = useState("");
  const [addInstrument, setAddInstrument] = useState<Instrument>("drums");

  const grouped = useMemo(() => {
    const groups: Record<string, Musician[]> = {};
    for (const inst of INSTRUMENT_ORDER) {
      groups[inst] = [];
    }
    for (const m of queue) {
      if (!groups[m.instrument]) groups[m.instrument] = [];
      groups[m.instrument].push(m);
    }
    return groups;
  }, [queue]);

  const handleAdd = useCallback(() => {
    if (!addAlias.trim()) return;
    onEmergencyAdd(addAlias.trim(), addInstrument);
    setAddAlias("");
    setAddInstrument("drums");
    setShowAddForm(false);
  }, [addAlias, addInstrument, onEmergencyAdd]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with count + emergency add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-(--color-text-muted)">
          {queue.length} musico{queue.length !== 1 ? "s" : ""} en espera
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg bg-(--color-amber) px-3 py-1.5 text-xs font-semibold text-black"
        >
          {showAddForm ? "Cancelar" : "+ Emergencia"}
        </button>
      </div>

      {/* Emergency add form */}
      {showAddForm && (
        <div className="rounded-xl border border-(--color-amber)/30 bg-(--color-bg-card) p-4">
          <h4 className="mb-3 text-sm font-semibold text-(--color-amber)">
            Agregar musico de emergencia
          </h4>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Nombre o alias"
              value={addAlias}
              onChange={(e) => setAddAlias(e.target.value)}
              className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-secondary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
            />
            <select
              value={addInstrument}
              onChange={(e) => setAddInstrument(e.target.value as Instrument)}
              className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-secondary) px-3 py-2 text-sm text-(--color-text-primary) outline-none focus:border-(--color-amber)"
            >
              {INSTRUMENT_ORDER.map((inst) => (
                <option key={inst} value={inst}>
                  {INSTRUMENT_ICONS[inst]} {inst}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!addAlias.trim()}
              className="mt-1 w-full rounded-lg bg-(--color-amber) py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Agregar a la cola
            </button>
          </div>
        </div>
      )}

      {queue.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-4xl">👥</p>
          <p className="mt-4 text-(--color-text-secondary)">
            No hay musicos en espera
          </p>
        </div>
      )}

      {INSTRUMENT_ORDER.map((inst) => {
        const musicians = grouped[inst];
        if (!musicians || musicians.length === 0) return null;
        return (
          <div key={inst}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
              <span>{INSTRUMENT_ICONS[inst]}</span>
              {inst}
              <span className="ml-auto rounded-full bg-(--color-bg-hover) px-2 py-0.5 text-[10px]">
                {musicians.length}
              </span>
            </h3>
            <div className="flex flex-col gap-1">
              {musicians.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg bg-(--color-bg-card) px-3 py-2"
                >
                  <span className="w-5 text-center text-xs font-bold text-(--color-text-muted)">
                    {i + 1}
                  </span>
                  <span className="text-sm text-(--color-text-primary)">
                    {m.alias}
                  </span>
                  <span className="ml-auto text-xs text-(--color-text-muted)">
                    {m.playCount} vez{m.playCount !== 1 ? "es" : ""}
                  </span>
                  <button
                    onClick={() => onRemove(m.id)}
                    className="ml-2 rounded-full p-1 text-xs text-red-400 hover:bg-red-400/20 hover:text-red-300"
                    title="Eliminar de la cola"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Setlist ──────────────────────────────────────────────────
function TabSetlist({
  suggested,
  official,
  onConfirmBlock,
  onRequestSuggestion,
}: {
  suggested: SetlistEntry[];
  official: SetlistEntry[];
  onConfirmBlock: (index: number) => void;
  onRequestSuggestion: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Suggested */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            Sugerencias del algoritmo
          </h3>
          <button
            onClick={onRequestSuggestion}
            className="rounded-lg bg-(--color-blue)/20 px-3 py-1.5 text-xs font-medium text-(--color-blue) hover:bg-(--color-blue)/30"
          >
            Sugerir alineacion
          </button>
        </div>
        {suggested.length === 0 ? (
          <p className="text-sm text-(--color-text-muted)">
            Sin sugerencias disponibles
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {suggested.map((entry, i) => (
              <div
                key={`sug-${entry.songId}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--color-text-primary)">
                    {entry.songTitle}
                  </p>
                  <p className="text-xs text-(--color-text-muted)">
                    {entry.assignedMusicians.map((m) => m.alias).join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => onConfirmBlock(entry.orderIndex)}
                  className="shrink-0 rounded-lg bg-(--color-amber) px-3 py-1.5 text-xs font-bold text-(--color-bg-primary) hover:bg-(--color-amber-dark)"
                >
                  Confirmar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Official */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
          Setlist oficial
        </h3>
        {official.length === 0 ? (
          <p className="text-sm text-(--color-text-muted)">
            Aun no hay bloques confirmados
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {official.map((entry, i) => (
              <div
                key={`off-${entry.songId}-${i}`}
                className="flex items-center gap-3 rounded-lg bg-(--color-bg-card) px-4 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-amber)/20 text-xs font-bold text-(--color-amber)">
                  {i + 1}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Catalogo ─────────────────────────────────────────────────
function TabCatalog({
  catalog,
  pendingProposals,
  onAdd,
  onEdit,
  onRemove,
  onApprove,
  onReject,
}: {
  catalog: Song[];
  pendingProposals: Song[];
  onAdd: (payload: { title: string; artist: string; genre: string; youtubeUrl?: string }) => void;
  onEdit: (songId: string, updates: Partial<Song>) => void;
  onRemove: (songId: string) => void;
  onApprove: (songId: string) => void;
  onReject: (songId: string) => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState<string>("all");

  const genres = ["all", "jazz", "blues", "funk", "groove", "latin", "other"];

  const filtered = useMemo(() => {
    let result = catalog.filter((s) => s.status === "active");
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
      );
    }
    if (genreFilter !== "all") {
      result = result.filter((s) => s.genre === genreFilter);
    }
    return result;
  }, [catalog, searchFilter, genreFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Proposals Section */}
      {pendingProposals.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            Propuestas pendientes
            <span className="rounded-full bg-(--color-amber) px-2 py-0.5 text-[10px] font-bold text-(--color-bg-primary)">
              {pendingProposals.length}
            </span>
          </h3>
          <div className="flex flex-col gap-2">
            {pendingProposals.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-3 rounded-lg border border-(--color-amber)/20 bg-(--color-bg-card) px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--color-text-primary)">
                    {song.title}
                    {song.youtubeUrl && (
                      <a
                        href={song.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-(--color-red) hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ▶
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-(--color-text-muted)">
                    {song.artist} · {song.genre}
                    {song.addedBy && ` · propuesta de ${song.addedBy}`}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onApprove(song.id)}
                    className="rounded-lg bg-(--color-green)/20 px-3 py-1.5 text-xs font-medium text-(--color-green) hover:bg-(--color-green)/30"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => onReject(song.id)}
                    className="rounded-lg bg-(--color-red)/20 px-3 py-1.5 text-xs font-medium text-(--color-red) hover:bg-(--color-red)/30"
                  >
                    ✗
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            Catalogo ({filtered.length})
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-(--color-amber) px-3 py-1.5 text-xs font-bold text-(--color-bg-primary) hover:bg-(--color-amber-dark)"
          >
            + Agregar
          </button>
        </div>

        {/* Filters */}
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="flex-1 rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-3 py-2 text-xs text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
          />
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-2 py-2 text-xs text-(--color-text-primary) outline-none focus:border-(--color-amber)"
          >
            {genres.map((g) => (
              <option key={g} value={g}>
                {g === "all" ? "Todos" : g}
              </option>
            ))}
          </select>
        </div>

        {/* Song List */}
        <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {filtered.map((song) => (
            <div
              key={song.id}
              className="flex items-center gap-2 rounded-lg bg-(--color-bg-card) px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--color-text-primary)">
                  {song.title}
                  {song.youtubeUrl && (
                    <a
                      href={song.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-(--color-red) hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ▶
                    </a>
                  )}
                </p>
                <p className="text-xs text-(--color-text-muted)">
                  {song.artist} · {song.genre}
                  {song.source !== "preset" && ` · ${song.source === "mc_added" ? "MC" : "propuesta"}`}
                </p>
              </div>
              <button
                onClick={() => setEditingSong(song)}
                className="shrink-0 rounded px-2 py-1 text-xs text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-secondary)"
              >
                Editar
              </button>
              <button
                onClick={() => onRemove(song.id)}
                className="shrink-0 rounded px-2 py-1 text-xs text-(--color-red)/60 hover:bg-(--color-red)/10 hover:text-(--color-red)"
              >
                ✗
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingSong) && (
        <SongFormModal
          song={editingSong}
          onSave={(data) => {
            if (editingSong) {
              onEdit(editingSong.id, data);
              setEditingSong(null);
            } else {
              onAdd(data);
              setShowAddModal(false);
            }
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingSong(null);
          }}
        />
      )}
    </div>
  );
}

function SongFormModal({
  song,
  onSave,
  onClose,
}: {
  song: Song | null;
  onSave: (data: { title: string; artist: string; genre: Genre; youtubeUrl?: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const [genre, setGenre] = useState<Genre>(song?.genre ?? "jazz");
  const [youtubeUrl, setYoutubeUrl] = useState(song?.youtubeUrl ?? "");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !artist.trim()) return;
      onSave({
        title: title.trim(),
        artist: artist.trim(),
        genre,
        youtubeUrl: youtubeUrl.trim() || undefined,
      });
    },
    [title, artist, genre, youtubeUrl, onSave]
  );

  // Extract YouTube thumbnail
  const thumbnailUrl = useMemo(() => {
    if (!youtubeUrl) return null;
    const match = youtubeUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  }, [youtubeUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-(--color-bg-hover) bg-(--color-bg-secondary) p-6"
      >
        <h3 className="mb-4 text-lg font-bold text-(--color-text-primary)">
          {song ? "Editar cancion" : "Agregar cancion"}
        </h3>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Titulo *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-3 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
            required
          />
          <input
            type="text"
            placeholder="Artista *"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-3 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
            required
          />
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value as Genre)}
            className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-3 py-2.5 text-sm text-(--color-text-primary) outline-none focus:border-(--color-amber)"
          >
            <option value="jazz">Jazz</option>
            <option value="blues">Blues</option>
            <option value="funk">Funk</option>
            <option value="groove">Groove</option>
            <option value="latin">Latin</option>
            <option value="other">Otro</option>
          </select>
          <input
            type="url"
            placeholder="Link YouTube (opcional)"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-3 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
          />

          {/* YouTube thumbnail preview */}
          {thumbnailUrl && (
            <div className="overflow-hidden rounded-lg">
              <img
                src={thumbnailUrl}
                alt="YouTube preview"
                className="h-auto w-full object-cover"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-(--color-bg-hover) bg-(--color-bg-card) px-4 py-2.5 text-sm font-medium text-(--color-text-secondary) hover:bg-(--color-bg-hover)"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-(--color-amber) px-4 py-2.5 text-sm font-bold text-(--color-bg-primary) hover:bg-(--color-amber-dark)"
          >
            {song ? "Guardar" : "Agregar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Tab: Exportar ─────────────────────────────────────────────────
function TabExport({
  history,
  totalMusicians,
  onEndEvent,
}: {
  history: { songTitle: string; duration: number }[];
  totalMusicians: number;
  onEndEvent: () => void;
}) {
  const totalDuration = useMemo(
    () => history.reduce((sum, b) => sum + b.duration, 0),
    [history]
  );
  const mins = Math.floor(totalDuration / 60);

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
        Estadisticas del evento
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Bloques tocados" value={String(history.length)} />
        <StatCard label="Musicos registrados" value={String(totalMusicians)} />
        <StatCard label="Tiempo total" value={`${mins} min`} />
        <StatCard label="Canciones unicas" value={String(new Set(history.map((b) => b.songTitle)).size)} />
      </div>

      <button
        onClick={onEndEvent}
        className="mt-4 min-h-12 w-full rounded-xl bg-(--color-red) px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-(--color-red)/80"
      >
        Finalizar Evento
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-(--color-bg-hover) bg-(--color-bg-card) p-4">
      <p className="text-2xl font-bold text-(--color-amber)">{value}</p>
      <p className="mt-1 text-xs text-(--color-text-muted)">{label}</p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function MCDashboard() {
  const eventId = useMemo(() => getEventId(), []);
  const { state, send } = usePartySocket({ eventId });
  const { saveIdentity } = useSessionIdentity();

  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("live");
  const [authError, setAuthError] = useState(false);

  const handleAuth = useCallback(
    (pin: string) => {
      send({ type: "mc_auth", payload: { pin } });

      // Optimistically authenticate. In production, listen for mc_auth_ok / mc_auth_fail.
      // For now, set a brief timeout to simulate.
      saveIdentity({
        eventId,
        musicianId: "mc",
        alias: "MC",
        role: "mc",
      });
      setAuthenticated(true);
      setAuthError(false);
    },
    [send, saveIdentity, eventId]
  );

  const handleTimerAction = useCallback(
    (action: "start" | "pause" | "reset") => {
      send({ type: "timer_action", payload: { action } });
    },
    [send]
  );

  const handleConfirmBlock = useCallback(
    (blockIndex: number) => {
      send({ type: "confirm_block", payload: { blockIndex } });
    },
    [send]
  );

  const handleEndEvent = useCallback(() => {
    send({ type: "end_event" });
  }, [send]);

  const handleCatalogAdd = useCallback(
    (payload: { title: string; artist: string; genre: string; youtubeUrl?: string }) => {
      send({
        type: "catalog_add",
        payload: payload as { title: string; artist: string; genre: "jazz" | "blues" | "groove" | "funk" | "latin" | "other"; youtubeUrl?: string },
      });
    },
    [send]
  );

  const handleCatalogEdit = useCallback(
    (songId: string, updates: Partial<Song>) => {
      send({ type: "catalog_edit", payload: { songId, updates } });
    },
    [send]
  );

  const handleCatalogRemove = useCallback(
    (songId: string) => {
      send({ type: "catalog_remove", payload: { songId } });
    },
    [send]
  );

  const handleProposalApprove = useCallback(
    (songId: string) => {
      send({ type: "proposal_approve", payload: { songId } });
    },
    [send]
  );

  const handleProposalReject = useCallback(
    (songId: string) => {
      send({ type: "proposal_reject", payload: { songId } });
    },
    [send]
  );

  const handleRequestSuggestion = useCallback(() => {
    send({ type: "request_suggestion" });
  }, [send]);

  const handleQueueRemove = useCallback(
    (musicianId: string) => {
      send({ type: "queue_remove", payload: { musicianId } });
    },
    [send]
  );

  const handleEmergencyAdd = useCallback(
    (alias: string, instrument: Instrument) => {
      send({ type: "emergency_add", payload: { alias, instrument } });
    },
    [send]
  );

  if (!authenticated) {
    return <PinGate onAuth={handleAuth} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-(--color-bg-primary)">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-(--color-bg-hover) px-4 py-3">
        <h1 className="text-lg font-bold text-(--color-amber)">MC Dashboard</h1>
        <span className="text-xs text-(--color-text-muted)">{eventId}</span>
      </header>

      {/* Tabs */}
      <nav className="flex overflow-x-auto border-b border-(--color-bg-hover)">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-(--color-amber) text-(--color-amber)"
                : "text-(--color-text-muted) hover:text-(--color-text-secondary)"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        {authError && (
          <div className="mb-4 rounded-lg bg-(--color-red)/10 px-4 py-2 text-sm text-(--color-red)">
            Error de autenticacion. Intenta de nuevo.
          </div>
        )}

        {activeTab === "live" && (
          <TabLive
            currentBlock={state?.currentBlock ?? null}
            timerRemaining={state?.timerRemaining ?? null}
            onTimerAction={handleTimerAction}
          />
        )}

        {activeTab === "queue" && (
          <TabQueue
            queue={state?.waitingQueue ?? []}
            onRemove={handleQueueRemove}
            onEmergencyAdd={handleEmergencyAdd}
          />
        )}

        {activeTab === "setlist" && (
          <TabSetlist
            suggested={state?.setlistSuggested ?? []}
            official={state?.setlistOfficial ?? []}
            onConfirmBlock={handleConfirmBlock}
            onRequestSuggestion={handleRequestSuggestion}
          />
        )}

        {activeTab === "catalog" && (
          <TabCatalog
            catalog={state?.catalog ?? []}
            pendingProposals={state?.pendingProposals ?? []}
            onAdd={handleCatalogAdd}
            onEdit={handleCatalogEdit}
            onRemove={handleCatalogRemove}
            onApprove={handleProposalApprove}
            onReject={handleProposalReject}
          />
        )}

        {activeTab === "export" && (
          <TabExport
            history={state?.history ?? []}
            totalMusicians={state?.waitingQueue.length ?? 0}
            onEndEvent={handleEndEvent}
          />
        )}
      </main>
    </div>
  );
}
