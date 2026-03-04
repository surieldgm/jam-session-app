import type { JamState, Musician, Song, SetlistEntry, AssignedMusician, Instrument } from "./types";

/**
 * CSP-inspired greedy algorithm for suggesting band lineups.
 *
 * Hard constraints:
 *   1. Each block MUST have at least drums + bass
 *   2. A musician can only occupy 1 position per block
 *   3. Only songs that at least 2 waiting musicians have in their top 3
 *
 * Soft constraints (heuristics):
 *   1. Priority: musicians with playCount = 0 go first
 *   2. Diversity: avoid repeating songs already played tonight
 *   3. Coverage: maximize number of musicians from the waiting queue
 */

const REQUIRED_INSTRUMENTS: Instrument[] = ["drums", "bass"];

interface CandidateSong {
  song: Song;
  coverageScore: number;
  availableMusicians: Musician[];
}

export function suggestLineup(
  state: JamState,
  numBlocks: number = 3
): SetlistEntry[] {
  const { waitingQueue, catalog, history } = state;

  if (waitingQueue.length < 2) return [];

  const activeSongs = catalog.filter((s) => s.status === "active");
  if (activeSongs.length === 0) return [];

  // Track which musicians have been assigned across blocks in this suggestion
  const assignedMusicianIds = new Set<string>();

  // Songs already played tonight (for diversity)
  const playedSongIds = new Set(history.map((b) => b.songId));

  const results: SetlistEntry[] = [];

  for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
    // Available musicians = waiting queue minus already assigned in this suggestion
    const available = waitingQueue.filter(
      (m) => !assignedMusicianIds.has(m.id)
    );

    if (available.length < 2) break;

    // Score each song
    const candidates: CandidateSong[] = [];

    for (const song of activeSongs) {
      // Find musicians who have this song in their top 3
      const interested = available.filter((m) =>
        m.topSongs.includes(song.id)
      );

      // Check hard constraint: at least 2 interested musicians
      if (interested.length < 2) continue;

      // Check hard constraint: need at least drums + bass among interested OR available
      const interestedInstruments = new Set(interested.map((m) => m.instrument));
      const hasDrums =
        interestedInstruments.has("drums") ||
        available.some((m) => m.instrument === "drums");
      const hasBass =
        interestedInstruments.has("bass") ||
        available.some((m) => m.instrument === "bass");

      if (!hasDrums || !hasBass) continue;

      // Coverage score: how many musicians with playCount=0 are interested
      const freshMusicians = interested.filter((m) => m.playCount === 0).length;
      const diversityBonus = playedSongIds.has(song.id) ? 0 : 2;
      const coverageScore = interested.length + freshMusicians * 2 + diversityBonus;

      candidates.push({
        song,
        coverageScore,
        availableMusicians: available,
      });
    }

    if (candidates.length === 0) {
      // Fallback: pick any song and assign available musicians
      const fallbackEntry = buildFallbackBlock(available, activeSongs, blockIdx);
      if (fallbackEntry) {
        for (const m of fallbackEntry.assignedMusicians) {
          assignedMusicianIds.add(m.musicianId);
        }
        results.push(fallbackEntry);
      }
      continue;
    }

    // Sort by coverage score descending
    candidates.sort((a, b) => b.coverageScore - a.coverageScore);

    const best = candidates[0];
    const entry = buildBlock(best, available, blockIdx);

    if (entry) {
      for (const m of entry.assignedMusicians) {
        assignedMusicianIds.add(m.musicianId);
      }
      // Mark song as used for diversity
      playedSongIds.add(best.song.id);
      results.push(entry);
    }
  }

  return results;
}

function buildBlock(
  candidate: CandidateSong,
  available: Musician[],
  orderIndex: number
): SetlistEntry | null {
  const { song } = candidate;

  // Step 1: Find interested musicians, sorted by playCount ASC then registeredAt ASC
  const interested = available
    .filter((m) => m.topSongs.includes(song.id))
    .sort((a, b) => a.playCount - b.playCount || a.registeredAt - b.registeredAt);

  // Step 2: Assign one musician per instrument, prioritizing interested ones
  const assigned: AssignedMusician[] = [];
  const usedIds = new Set<string>();
  const filledInstruments = new Set<string>();

  // First pass: fill from interested musicians
  for (const m of interested) {
    if (usedIds.has(m.id) || filledInstruments.has(m.instrument)) continue;
    assigned.push({
      musicianId: m.id,
      alias: m.alias,
      instrument: m.instrument,
    });
    usedIds.add(m.id);
    filledInstruments.add(m.instrument);
  }

  // Second pass: ensure required instruments (drums, bass)
  for (const reqInst of REQUIRED_INSTRUMENTS) {
    if (filledInstruments.has(reqInst)) continue;

    // Find an available musician with this instrument
    const fill = available
      .filter((m) => m.instrument === reqInst && !usedIds.has(m.id))
      .sort((a, b) => a.playCount - b.playCount || a.registeredAt - b.registeredAt);

    if (fill.length > 0) {
      const m = fill[0];
      assigned.push({
        musicianId: m.id,
        alias: m.alias,
        instrument: m.instrument,
      });
      usedIds.add(m.id);
      filledInstruments.add(m.instrument);
    }
  }

  // Verify hard constraint: must have drums + bass
  if (!filledInstruments.has("drums") || !filledInstruments.has("bass")) {
    return null;
  }

  return {
    songId: song.id,
    songTitle: song.title,
    youtubeUrl: song.youtubeUrl,
    assignedMusicians: assigned,
    orderIndex,
  };
}

function buildFallbackBlock(
  available: Musician[],
  songs: Song[],
  orderIndex: number
): SetlistEntry | null {
  // Pick the first song and assign whoever is available
  if (songs.length === 0 || available.length < 2) return null;

  const song = songs[0];
  const assigned: AssignedMusician[] = [];
  const usedIds = new Set<string>();
  const filledInstruments = new Set<string>();

  // Sort by playCount ASC
  const sorted = [...available].sort(
    (a, b) => a.playCount - b.playCount || a.registeredAt - b.registeredAt
  );

  // Fill required instruments first
  for (const reqInst of REQUIRED_INSTRUMENTS) {
    const m = sorted.find(
      (m) => m.instrument === reqInst && !usedIds.has(m.id)
    );
    if (m) {
      assigned.push({
        musicianId: m.id,
        alias: m.alias,
        instrument: m.instrument,
      });
      usedIds.add(m.id);
      filledInstruments.add(m.instrument);
    }
  }

  if (!filledInstruments.has("drums") || !filledInstruments.has("bass")) {
    return null;
  }

  // Fill remaining slots (one per instrument, up to 6 musicians)
  for (const m of sorted) {
    if (usedIds.has(m.id) || filledInstruments.has(m.instrument)) continue;
    if (assigned.length >= 6) break;
    assigned.push({
      musicianId: m.id,
      alias: m.alias,
      instrument: m.instrument,
    });
    usedIds.add(m.id);
    filledInstruments.add(m.instrument);
  }

  return {
    songId: song.id,
    songTitle: song.title,
    youtubeUrl: song.youtubeUrl,
    assignedMusicians: assigned,
    orderIndex,
  };
}
