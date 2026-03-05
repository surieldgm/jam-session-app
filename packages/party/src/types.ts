// Shared types - mirrored from web/src/types/index.ts for the party server

export type Genre = "jazz" | "blues" | "groove" | "funk" | "latin" | "other";
export type Instrument = "drums" | "bass" | "keys" | "guitar" | "vocals" | "winds";

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  youtubeUrl?: string;
  source: "preset" | "mc_added" | "participant_proposal";
  addedBy?: string;
  status: "active" | "pending_review";
}

export interface Musician {
  id: string;
  alias: string;
  instrument: Instrument;
  topSongs: string[];
  proposedSongs: string[];
  playCount: number;
  registeredAt: number;
}

export interface AssignedMusician {
  musicianId: string;
  alias: string;
  instrument: string;
}

export interface SetlistEntry {
  songId: string;
  songTitle: string;
  youtubeUrl?: string;
  assignedMusicians: AssignedMusician[];
  orderIndex: number;
}

export interface CompletedBlock {
  songId: string;
  songTitle: string;
  youtubeUrl?: string;
  musicians: AssignedMusician[];
  startedAt: number;
  endedAt: number;
  duration: number;
}

export interface JamState {
  eventId: string;
  startedAt: number;
  mcPin: string;
  version: number;
  catalog: Song[];
  pendingProposals: Song[];
  currentBlock: {
    songId: string;
    songTitle: string;
    musicians: AssignedMusician[];
    startTime: number;
    status: "playing" | "transitioning";
  } | null;
  waitingQueue: Musician[];
  setlistOfficial: SetlistEntry[];
  setlistSuggested: SetlistEntry[];
  history: CompletedBlock[];
}

export type ClientMessage =
  | { type: "register"; payload: { alias: string; instrument: Instrument; topSongs: string[] } }
  | { type: "reconnect"; payload: { musicianId: string } }
  | { type: "propose_song"; payload: { title: string; artist: string; genre: Genre; youtubeUrl?: string } }
  | { type: "mc_auth"; payload: { pin: string } }
  | { type: "catalog_add"; payload: { title: string; artist: string; genre: Genre; youtubeUrl?: string } }
  | { type: "catalog_edit"; payload: { songId: string; updates: Partial<Song> } }
  | { type: "catalog_remove"; payload: { songId: string } }
  | { type: "proposal_approve"; payload: { songId: string } }
  | { type: "proposal_reject"; payload: { songId: string } }
  | { type: "confirm_block"; payload: { blockIndex: number } }
  | { type: "request_suggestion" }
  | { type: "timer_action"; payload: { action: "start" | "pause" | "reset" } }
  | { type: "end_event" }
  | { type: "queue_remove"; payload: { musicianId: string } }
  | { type: "emergency_add"; payload: { alias: string; instrument: Instrument } };

export type ServerMessage =
  | { type: "full_state"; payload: JamState }
  | { type: "reconnect_ok"; payload: { musician: Musician; fullState: JamState } }
  | { type: "identity_not_found" }
  | { type: "mc_auth_ok" }
  | { type: "mc_auth_fail" }
  | { type: "musician_joined"; payload: Musician }
  | { type: "musician_removed"; payload: { musicianId: string } }
  | { type: "catalog_updated"; payload: { catalog: Song[] } }
  | { type: "new_proposal"; payload: Song }
  | { type: "proposal_resolved"; payload: { songId: string; approved: boolean } }
  | { type: "block_confirmed"; payload: SetlistEntry }
  | { type: "block_started"; payload: { songTitle: string; musicians: AssignedMusician[]; startTime: number } }
  | { type: "timer_tick"; payload: { remaining: number } }
  | { type: "block_completed"; payload: CompletedBlock }
  | { type: "event_ended"; payload: { finalState: JamState } };
