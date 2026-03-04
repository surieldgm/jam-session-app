import type { Song, Genre, JamState } from "./types";

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Initialize the catalog from default entries.
 * Assigns IDs, sets source/status fields.
 */
export function initCatalogFromDefaults(
  defaults: { title: string; artist: string; genre: Genre; youtubeUrl?: string }[]
): Song[] {
  return defaults.map((entry) => ({
    id: generateId(),
    title: entry.title,
    artist: entry.artist,
    genre: entry.genre,
    youtubeUrl: entry.youtubeUrl,
    source: "preset" as const,
    status: "active" as const,
  }));
}

/**
 * Add a new song to the catalog (MC action).
 */
export function addSongToCatalog(
  state: JamState,
  payload: { title: string; artist: string; genre: Genre; youtubeUrl?: string }
): Song {
  const song: Song = {
    id: generateId(),
    title: payload.title,
    artist: payload.artist,
    genre: payload.genre,
    youtubeUrl: payload.youtubeUrl,
    source: "mc_added",
    status: "active",
  };
  state.catalog.push(song);
  return song;
}

/**
 * Edit an existing song in the catalog (MC action).
 */
export function editSongInCatalog(
  state: JamState,
  songId: string,
  updates: Partial<Song>
): boolean {
  const idx = state.catalog.findIndex((s) => s.id === songId);
  if (idx === -1) return false;

  const song = state.catalog[idx];
  if (updates.title !== undefined) song.title = updates.title;
  if (updates.artist !== undefined) song.artist = updates.artist;
  if (updates.genre !== undefined) song.genre = updates.genre;
  if (updates.youtubeUrl !== undefined) song.youtubeUrl = updates.youtubeUrl;

  return true;
}

/**
 * Remove a song from the catalog (MC action).
 */
export function removeSongFromCatalog(
  state: JamState,
  songId: string
): boolean {
  const idx = state.catalog.findIndex((s) => s.id === songId);
  if (idx === -1) return false;
  state.catalog.splice(idx, 1);
  return true;
}

/**
 * Add a participant song proposal to pendingProposals.
 */
export function addProposal(
  state: JamState,
  payload: {
    title: string;
    artist: string;
    genre: Genre;
    youtubeUrl?: string;
    addedBy: string;
  }
): Song {
  const song: Song = {
    id: generateId(),
    title: payload.title,
    artist: payload.artist,
    genre: payload.genre,
    youtubeUrl: payload.youtubeUrl,
    source: "participant_proposal",
    addedBy: payload.addedBy,
    status: "pending_review",
  };
  state.pendingProposals.push(song);
  return song;
}

/**
 * Approve a pending proposal → move to active catalog.
 */
export function approveProposal(
  state: JamState,
  songId: string
): Song | null {
  const idx = state.pendingProposals.findIndex((s) => s.id === songId);
  if (idx === -1) return null;

  const [song] = state.pendingProposals.splice(idx, 1);
  song.status = "active";
  state.catalog.push(song);
  return song;
}

/**
 * Reject a pending proposal → remove from pendingProposals.
 */
export function rejectProposal(
  state: JamState,
  songId: string
): boolean {
  const idx = state.pendingProposals.findIndex((s) => s.id === songId);
  if (idx === -1) return false;
  state.pendingProposals.splice(idx, 1);
  return true;
}
