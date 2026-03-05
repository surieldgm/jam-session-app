import { useState, useMemo, useCallback } from "react";
import { usePartySocket } from "../hooks/usePartySocket";
import { useSessionIdentity } from "../hooks/useSessionIdentity";
import type { Instrument, Genre } from "../types";
import { v4 as uuidv4 } from "uuid";

function getEventId(): string {
  return `jam-${new Date().toISOString().split("T")[0]}`;
}

const MAX_SONGS = 3;

const INSTRUMENTS: { id: Instrument; label: string; icon: string }[] = [
  { id: "drums", label: "Bateria", icon: "🥁" },
  { id: "bass", label: "Bajo", icon: "🎸" },
  { id: "keys", label: "Teclado", icon: "🎹" },
  { id: "guitar", label: "Guitarra", icon: "🎸" },
  { id: "vocals", label: "Voz", icon: "🎤" },
  { id: "winds", label: "Vientos", icon: "🎷" },
];

// ─── Step 1: Instrument Picker ─────────────────────────────────────
function InstrumentPicker({
  selected,
  onSelect,
}: {
  selected: Instrument | null;
  onSelect: (instrument: Instrument) => void;
}) {
  return (
    <div className="w-full max-w-sm">
      <h2 className="mb-6 text-center text-xl font-bold text-(--color-text-primary)">
        &iquest;Qu&eacute; instrumento tocas?
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst.id}
            onClick={() => onSelect(inst.id)}
            className={`flex min-h-20 flex-col items-center justify-center rounded-xl border-2 px-4 py-4 transition-all active:scale-[0.97] ${
              selected === inst.id
                ? "border-(--color-amber) bg-(--color-amber)/10 text-(--color-amber)"
                : "border-(--color-bg-hover) bg-(--color-bg-card) text-(--color-text-secondary) hover:border-(--color-text-muted)"
            }`}
          >
            <span className="text-3xl">{inst.icon}</span>
            <span className="mt-1 text-sm font-medium">{inst.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const GENRE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "jazz", label: "Jazz" },
  { value: "blues", label: "Blues" },
  { value: "funk", label: "Funk" },
  { value: "groove", label: "Groove" },
  { value: "latin", label: "Latin" },
  { value: "other", label: "Otro" },
];

// ─── Step 2: Song Selector ─────────────────────────────────────────
function SongSelector({
  catalog,
  selectedSongs,
  onToggle,
  maxReached,
  onPropose,
}: {
  catalog: { id: string; title: string; artist: string; genre: string }[];
  selectedSongs: string[];
  onToggle: (songId: string) => void;
  maxReached: boolean;
  onPropose: (data: { title: string; artist: string; genre: Genre; youtubeUrl?: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalSent, setProposalSent] = useState(false);

  const filtered = useMemo(() => {
    let result = catalog;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
      );
    }
    if (genreFilter !== "all") {
      result = result.filter((s) => s.genre === genreFilter);
    }
    return result;
  }, [catalog, search, genreFilter]);

  const handleProposalSubmit = useCallback(
    (data: { title: string; artist: string; genre: Genre; youtubeUrl?: string }) => {
      onPropose(data);
      setShowProposalForm(false);
      setProposalSent(true);
      setTimeout(() => setProposalSent(false), 3000);
    },
    [onPropose]
  );

  return (
    <div className="w-full max-w-sm">
      <h2 className="mb-2 text-center text-xl font-bold text-(--color-text-primary)">
        Elige tus canciones
      </h2>
      <p className="mb-4 text-center text-sm text-(--color-text-muted)">
        Selecciona hasta {MAX_SONGS} canciones que te gustaria tocar
      </p>

      {/* Search + Genre filter */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          placeholder="Buscar cancion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-3 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
        />
        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-2 py-2.5 text-xs text-(--color-text-primary) outline-none focus:border-(--color-amber)"
        >
          {GENRE_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {/* Song list */}
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-(--color-text-muted)">
            No se encontraron canciones
          </p>
        )}
        {filtered.map((song) => {
          const isSelected = selectedSongs.includes(song.id);
          const isDisabled = !isSelected && maxReached;
          return (
            <button
              key={song.id}
              onClick={() => onToggle(song.id)}
              disabled={isDisabled}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? "bg-(--color-amber)/10 text-(--color-amber)"
                  : isDisabled
                    ? "bg-(--color-bg-card) text-(--color-text-muted) opacity-40 cursor-not-allowed"
                    : "bg-(--color-bg-card) text-(--color-text-secondary) hover:bg-(--color-bg-hover)"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                  isSelected
                    ? "border-(--color-amber) bg-(--color-amber) text-(--color-bg-primary)"
                    : "border-(--color-text-muted)"
                }`}
              >
                {isSelected ? "✓" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{song.title}</p>
                <p className="truncate text-xs text-(--color-text-muted)">
                  {song.artist}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className={`mt-3 text-center text-xs ${maxReached ? "font-semibold text-(--color-amber)" : "text-(--color-text-muted)"}`}>
        {selectedSongs.length}/{MAX_SONGS} seleccionada{selectedSongs.length !== 1 ? "s" : ""}
      </p>

      {/* Propose song */}
      {proposalSent && (
        <p className="mt-2 text-center text-xs font-medium text-(--color-green)">
          Propuesta enviada ✓
        </p>
      )}

      {!showProposalForm ? (
        <button
          onClick={() => setShowProposalForm(true)}
          className="mt-3 w-full rounded-lg border border-dashed border-(--color-text-muted) py-2.5 text-xs font-medium text-(--color-text-muted) hover:border-(--color-amber) hover:text-(--color-amber)"
        >
          + Proponer una cancion
        </button>
      ) : (
        <ProposalForm
          onSubmit={handleProposalSubmit}
          onCancel={() => setShowProposalForm(false)}
        />
      )}
    </div>
  );
}

// ─── Proposal Form (inline) ──────────────────────────────────────────
function ProposalForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { title: string; artist: string; genre: Genre; youtubeUrl?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState<Genre>("jazz");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !artist.trim()) return;
      onSubmit({
        title: title.trim(),
        artist: artist.trim(),
        genre,
        youtubeUrl: youtubeUrl.trim() || undefined,
      });
    },
    [title, artist, genre, youtubeUrl, onSubmit]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-2 rounded-xl border border-(--color-amber)/30 bg-(--color-bg-card) p-3"
    >
      <p className="text-xs font-semibold text-(--color-amber)">Proponer cancion</p>
      <input
        type="text"
        placeholder="Titulo *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-secondary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
        required
      />
      <input
        type="text"
        placeholder="Artista *"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-secondary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
        required
      />
      <select
        value={genre}
        onChange={(e) => setGenre(e.target.value as Genre)}
        className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-secondary) px-3 py-2 text-sm text-(--color-text-primary) outline-none focus:border-(--color-amber)"
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
        className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-secondary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-(--color-bg-hover) py-2 text-xs font-medium text-(--color-text-secondary) hover:bg-(--color-bg-hover)"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-(--color-amber) py-2 text-xs font-bold text-(--color-bg-primary) hover:bg-(--color-amber-dark)"
        >
          Enviar
        </button>
      </div>
    </form>
  );
}

// ─── Step 3: Confirmation ──────────────────────────────────────────
function Confirmation({
  alias,
  instrument,
  songCount,
  onConfirm,
  isSubmitting,
}: {
  alias: string;
  instrument: Instrument;
  songCount: number;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  const inst = INSTRUMENTS.find((i) => i.id === instrument);
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <h2 className="text-xl font-bold text-(--color-text-primary)">Confirmar registro</h2>

      <div className="w-full rounded-xl border border-(--color-bg-hover) bg-(--color-bg-card) p-5">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-3xl">{inst?.icon ?? "🎵"}</span>
          <div>
            <p className="font-semibold text-(--color-text-primary)">{alias}</p>
            <p className="text-sm text-(--color-text-muted)">{inst?.label ?? instrument}</p>
          </div>
        </div>
        <p className="text-sm text-(--color-text-secondary)">
          {songCount} cancion{songCount !== 1 ? "es" : ""} seleccionada{songCount !== 1 ? "s" : ""}
        </p>
      </div>

      <button
        onClick={onConfirm}
        disabled={isSubmitting}
        className="w-full min-h-12 rounded-xl bg-(--color-amber) px-6 py-4 text-lg font-bold text-(--color-bg-primary) transition-colors hover:bg-(--color-amber-dark) active:scale-[0.98] disabled:opacity-50"
      >
        {isSubmitting ? "Registrando..." : "Registrarme"}
      </button>
    </div>
  );
}

// ─── Waiting Screen ────────────────────────────────────────────────
function WaitingScreen({
  alias,
  queuePosition,
}: {
  alias: string;
  queuePosition: number;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="text-5xl">✅</span>
      <h2 className="text-2xl font-bold text-(--color-text-primary)">
        Estas dentro, {alias}!
      </h2>
      <p className="text-(--color-text-secondary)">
        Tu posicion en la cola:{" "}
        <span className="font-bold text-(--color-amber)">#{queuePosition}</span>
      </p>
      <p className="text-sm text-(--color-text-muted)">
        Quedate atento, te avisaremos cuando sea tu turno.
      </p>
      <div className="mt-4 h-8 w-8 animate-spin rounded-full border-2 border-(--color-amber) border-t-transparent" />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function Participant() {
  const eventId = useMemo(() => getEventId(), []);
  const { state, send } = usePartySocket({ eventId });
  const { saveIdentity } = useSessionIdentity();

  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [alias, setAlias] = useState("");
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);

  const catalog = useMemo(() => {
    if (!state) return [];
    return state.catalog
      .filter((s) => s.status === "active")
      .map((s) => ({ id: s.id, title: s.title, artist: s.artist, genre: s.genre }));
  }, [state]);

  const handleInstrumentSelect = useCallback((inst: Instrument) => {
    setInstrument(inst);
  }, []);

  const handleSongToggle = useCallback((songId: string) => {
    setSelectedSongs((prev) => {
      if (prev.includes(songId)) {
        return prev.filter((id) => id !== songId);
      }
      if (prev.length >= MAX_SONGS) return prev;
      return [...prev, songId];
    });
  }, []);

  const handlePropose = useCallback(
    (data: { title: string; artist: string; genre: Genre; youtubeUrl?: string }) => {
      send({ type: "propose_song", payload: data });
    },
    [send]
  );

  const handleConfirm = useCallback(() => {
    if (!instrument || !alias.trim()) return;
    setIsSubmitting(true);

    const musicianId = uuidv4();

    send({
      type: "register",
      payload: {
        alias: alias.trim(),
        instrument,
        topSongs: selectedSongs,
      },
    });

    saveIdentity({
      eventId,
      musicianId,
      alias: alias.trim(),
      instrument,
      role: "participant",
    });

    const position = state ? state.waitingQueue.length + 1 : 1;
    setQueuePosition(position);
    setStep("done");
    setIsSubmitting(false);
  }, [instrument, alias, selectedSongs, send, saveIdentity, eventId, state]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-(--color-bg-primary) px-6 py-8">
      {/* Progress bar */}
      {step !== "done" && (
        <div className="mb-8 flex w-full max-w-sm items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= (step as number)
                  ? "bg-(--color-amber)"
                  : "bg-(--color-bg-hover)"
              }`}
            />
          ))}
        </div>
      )}

      {/* Step 1: Instrument + Alias */}
      {step === 1 && (
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <InstrumentPicker
            selected={instrument}
            onSelect={handleInstrumentSelect}
          />

          <div className="w-full">
            <label className="mb-1.5 block text-center text-sm font-medium text-(--color-text-secondary)">
              &iquest;C&oacute;mo te llamamos en el escenario?
            </label>
            <input
              type="text"
              placeholder="Ej: Santi, El Baterista..."
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={24}
              className="w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-4 py-3 text-center text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
            />
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!instrument || !alias.trim()}
            className="w-full min-h-12 rounded-xl bg-(--color-amber) px-6 py-4 text-lg font-bold text-(--color-bg-primary) transition-colors hover:bg-(--color-amber-dark) disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Step 2: Song selector */}
      {step === 2 && (
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <SongSelector
            catalog={catalog}
            selectedSongs={selectedSongs}
            onToggle={handleSongToggle}
            maxReached={selectedSongs.length >= MAX_SONGS}
            onPropose={handlePropose}
          />

          <div className="flex w-full gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 min-h-12 rounded-xl border border-(--color-bg-hover) bg-(--color-bg-card) px-4 py-3 text-sm font-medium text-(--color-text-secondary) hover:bg-(--color-bg-hover)"
            >
              Atras
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 min-h-12 rounded-xl bg-(--color-amber) px-4 py-3 text-sm font-bold text-(--color-bg-primary) hover:bg-(--color-amber-dark) disabled:opacity-30"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && instrument && (
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <Confirmation
            alias={alias}
            instrument={instrument}
            songCount={selectedSongs.length}
            onConfirm={handleConfirm}
            isSubmitting={isSubmitting}
          />

          <button
            onClick={() => setStep(2)}
            className="text-sm text-(--color-text-muted) underline underline-offset-4 hover:text-(--color-text-secondary)"
          >
            Volver a editar
          </button>
        </div>
      )}

      {/* Done: Waiting screen */}
      {step === "done" && (
        <WaitingScreen alias={alias} queuePosition={queuePosition} />
      )}
    </div>
  );
}
