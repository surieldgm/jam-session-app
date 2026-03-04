import type * as Party from "partykit/server";
import type { JamState } from "./types";

const SNAPSHOT_KEY = "jam_snapshot";
const SNAPSHOT_INTERVAL = 10;

interface Snapshot {
  state: JamState;
  savedAt: number;
}

export async function saveSnapshot(
  room: Party.Room,
  state: JamState
): Promise<void> {
  const snapshot: Snapshot = {
    state,
    savedAt: Date.now(),
  };
  await room.storage.put(SNAPSHOT_KEY, snapshot);
  console.log(
    `[SNAPSHOT] Saved at version ${state.version}, eventId=${state.eventId}`
  );
}

export async function loadSnapshot(
  room: Party.Room
): Promise<JamState | null> {
  const snapshot = (await room.storage.get(SNAPSHOT_KEY)) as
    | Snapshot
    | undefined;

  if (!snapshot) {
    console.log("[SNAPSHOT] No snapshot found");
    return null;
  }

  // If snapshot is older than 6 hours, it's from a previous event → discard
  const MAX_AGE_MS = 6 * 60 * 60 * 1000;
  if (Date.now() - snapshot.savedAt > MAX_AGE_MS) {
    console.log("[SNAPSHOT] Snapshot expired, discarding");
    await room.storage.delete(SNAPSHOT_KEY);
    return null;
  }

  console.log(
    `[SNAPSHOT] Restored: eventId=${snapshot.state.eventId}, version=${snapshot.state.version}, age=${Math.round((Date.now() - snapshot.savedAt) / 1000)}s`
  );
  return snapshot.state;
}

export async function clearSnapshot(room: Party.Room): Promise<void> {
  await room.storage.delete(SNAPSHOT_KEY);
  console.log("[SNAPSHOT] Cleared");
}

export function shouldSnapshot(
  state: JamState,
  interval = SNAPSHOT_INTERVAL
): boolean {
  return state.version % interval === 0;
}
