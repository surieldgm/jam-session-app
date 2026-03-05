import { useState, useMemo, useCallback } from "react";
import { usePartySocket } from "../hooks/usePartySocket";
import { useSessionIdentity } from "../hooks/useSessionIdentity";
import type { Instrument } from "../types";
import { v4 as uuidv4 } from "uuid";

function getEventId(): string {
  return `jam-${new Date().toISOString().split("T")[0]}`;
}

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

// ─── Step 2: Song Selector ─────────────────────────────────────────
function SongSelector({
  catalog,
  selectedSongs,
  onToggle,
}: {
  catalog: { id: string; title: string; artist: string }[];
  selectedSongs: string[];
  onToggle: (songId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase();
    return catalog.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  return (
    <div className="w-full max-w-sm">
      <h2 className="mb-2 text-center text-xl font-bold text-(--color-text-primary)">
        Elige tus canciones
      </h2>
      <p className="mb-4 text-center text-sm text-(--color-text-muted)">
        Selecciona las canciones que te gustaria tocar
      </p>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar cancion..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-lg border border-(--color-bg-hover) bg-(--color-bg-card) px-4 py-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-amber)"
      />

      {/* Song list */}
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-(--color-text-muted)">
            No se encontraron canciones
          </p>
        )}
        {filtered.map((song) => {
          const isSelected = selectedSongs.includes(song.id);
          return (
            <button
              key={song.id}
              onClick={() => onToggle(song.id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? "bg-(--color-amber)/10 text-(--color-amber)"
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

      <p className="mt-3 text-center text-xs text-(--color-text-muted)">
        {selectedSongs.length} seleccionada{selectedSongs.length !== 1 ? "s" : ""}
      </p>
    </div>
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
      .map((s) => ({ id: s.id, title: s.title, artist: s.artist }));
  }, [state]);

  const handleInstrumentSelect = useCallback((inst: Instrument) => {
    setInstrument(inst);
  }, []);

  const handleSongToggle = useCallback((songId: string) => {
    setSelectedSongs((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  }, []);

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
