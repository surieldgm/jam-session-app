export const MC_PIN = "1234";
export const BASE_URL = "http://localhost:3000";
export const PARTYKIT_HOST = "localhost:1999";

export function getTodayEventId(): string {
  return `jam-${new Date().toISOString().split("T")[0]}`;
}

export const TEST_MUSICIANS = {
  drummer: {
    alias: "Test Drummer",
    instrument: "drums" as const,
  },
  bassist: {
    alias: "Test Bassist",
    instrument: "bass" as const,
  },
  pianist: {
    alias: "Test Pianist",
    instrument: "keys" as const,
  },
};

export const INSTRUMENTS = [
  { id: "drums", label: "Bateria" },
  { id: "bass", label: "Bajo" },
  { id: "keys", label: "Teclado" },
  { id: "guitar", label: "Guitarra" },
  { id: "vocals", label: "Voz" },
  { id: "winds", label: "Vientos" },
];

export const GENRES = ["all", "jazz", "blues", "funk", "groove", "latin", "other"];

/** Session identity shape stored in localStorage */
export interface TestSessionIdentity {
  eventId: string;
  musicianId: string;
  alias: string;
  instrument?: string;
  role: "participant" | "companion" | "mc";
}

/** localStorage key used by the app */
export const STORAGE_KEY = "jam_session_identity";
