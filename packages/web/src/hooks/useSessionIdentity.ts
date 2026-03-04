import type { SessionIdentity } from "../types";

const STORAGE_KEY = "jam_session_identity";

export function useSessionIdentity() {
  function getSavedIdentity(eventId: string): SessionIdentity | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const identity: SessionIdentity = JSON.parse(raw);
      if (identity.eventId !== eventId) return null;
      return identity;
    } catch {
      return null;
    }
  }

  function saveIdentity(identity: SessionIdentity): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  }

  function clearIdentity(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { getSavedIdentity, saveIdentity, clearIdentity };
}
