import type * as Party from "partykit/server";
import type {
  JamState,
  ClientMessage,
  ServerMessage,
  Musician,
  Song,
  SetlistEntry,
  CompletedBlock,
  Genre,
} from "./types";
import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  shouldSnapshot,
} from "./persistence";
import {
  initCatalogFromDefaults,
  addSongToCatalog,
  editSongInCatalog,
  removeSongFromCatalog,
  addProposal,
  approveProposal,
  rejectProposal,
} from "./catalog";
import { suggestLineup } from "./matcher";

// ─── Default catalog (embedded to avoid cross-package imports) ────
const DEFAULT_CATALOG: {
  title: string;
  artist: string;
  genre: Genre;
  youtubeUrl?: string;
}[] = [
  { title: "Watermelon Man", artist: "Herbie Hancock", genre: "jazz", youtubeUrl: "https://www.youtube.com/watch?v=4bjPlBC4h_8" },
  { title: "Cantaloupe Island", artist: "Herbie Hancock", genre: "jazz", youtubeUrl: "https://www.youtube.com/watch?v=8B1oIXGX0Io" },
  { title: "Autumn Leaves", artist: "Standard", genre: "jazz" },
  { title: "Blue Monk", artist: "Thelonious Monk", genre: "jazz" },
  { title: "Take Five", artist: "Dave Brubeck", genre: "jazz" },
  { title: "So What", artist: "Miles Davis", genre: "jazz" },
  { title: "All Blues", artist: "Miles Davis", genre: "jazz" },
  { title: "Freddie Freeloader", artist: "Miles Davis", genre: "jazz" },
  { title: "Fly Me to the Moon", artist: "Standard", genre: "jazz" },
  { title: "Summertime", artist: "Standard", genre: "jazz" },
  { title: "Blue Bossa", artist: "Kenny Dorham", genre: "jazz" },
  { title: "Footprints", artist: "Wayne Shorter", genre: "jazz" },
  { title: "Maiden Voyage", artist: "Herbie Hancock", genre: "jazz" },
  { title: "Song for My Father", artist: "Horace Silver", genre: "jazz" },
  { title: "Misty", artist: "Erroll Garner", genre: "jazz" },
  { title: "Round Midnight", artist: "Thelonious Monk", genre: "jazz" },
  { title: "A Night in Tunisia", artist: "Dizzy Gillespie", genre: "jazz" },
  { title: "My Favorite Things", artist: "John Coltrane", genre: "jazz" },
  { title: "Stella by Starlight", artist: "Standard", genre: "jazz" },
  { title: "All the Things You Are", artist: "Standard", genre: "jazz" },
  { title: "The Thrill Is Gone", artist: "B.B. King", genre: "blues" },
  { title: "Stormy Monday", artist: "T-Bone Walker", genre: "blues" },
  { title: "Red House", artist: "Jimi Hendrix", genre: "blues" },
  { title: "Blues for Alice", artist: "Charlie Parker", genre: "blues" },
  { title: "Billie's Bounce", artist: "Charlie Parker", genre: "blues" },
  { title: "Straight No Chaser", artist: "Thelonious Monk", genre: "blues" },
  { title: "Chameleon", artist: "Herbie Hancock", genre: "funk", youtubeUrl: "https://www.youtube.com/watch?v=UbkqE4fpvdI" },
  { title: "The Chicken", artist: "Jaco Pastorius", genre: "funk" },
  { title: "Pick Up the Pieces", artist: "Average White Band", genre: "funk" },
  { title: "Superstition", artist: "Stevie Wonder", genre: "funk" },
  { title: "Sir Duke", artist: "Stevie Wonder", genre: "funk" },
  { title: "Cissy Strut", artist: "The Meters", genre: "groove" },
  { title: "Use Me", artist: "Bill Withers", genre: "groove" },
  { title: "Lovely Day", artist: "Bill Withers", genre: "groove" },
  { title: "Oye Como Va", artist: "Tito Puente", genre: "latin" },
  { title: "Black Orpheus", artist: "Luiz Bonfá", genre: "latin" },
  { title: "The Girl from Ipanema", artist: "Tom Jobim", genre: "latin" },
  { title: "Desafinado", artist: "Tom Jobim", genre: "latin" },
  { title: "Bésame Mucho", artist: "Consuelo Velázquez", genre: "latin" },
  { title: "Spain", artist: "Chick Corea", genre: "latin" },
];

const BLOCK_DURATION_MS = 7 * 60 * 1000; // 7 minutes
const TIMER_INTERVAL_MS = 1000;
const DEFAULT_MC_PIN = "1234";

// ─── Helper: Create fresh state ──────────────────────────────────
function createFreshState(mcPin: string = DEFAULT_MC_PIN): JamState {
  const today = new Date().toISOString().split("T")[0];
  return {
    eventId: `jam-${today}`,
    startedAt: Date.now(),
    mcPin,
    version: 0,
    catalog: initCatalogFromDefaults(DEFAULT_CATALOG),
    pendingProposals: [],
    currentBlock: null,
    waitingQueue: [],
    setlistOfficial: [],
    setlistSuggested: [],
    history: [],
  };
}

// ─── Server ──────────────────────────────────────────────────────
export default class JamRoom implements Party.Server {
  state: JamState;
  timerInterval: ReturnType<typeof setInterval> | null = null;
  mcConnections: Set<string> = new Set();

  get mcPin(): string {
    return (this.room.env?.MC_PIN as string) ?? DEFAULT_MC_PIN;
  }

  constructor(public room: Party.Room) {
    this.state = createFreshState(this.mcPin);
  }

  // Called when the room starts or wakes from hibernation
  async onStart() {
    const restored = await loadSnapshot(this.room);
    if (restored) {
      this.state = restored;
      console.log(
        `[RESTORE] Session restored: eventId=${restored.eventId}, version=${restored.version}`
      );

      // If a block was playing, resume the timer
      if (this.state.currentBlock?.status === "playing") {
        this.startTimer();
      }
    } else {
      this.state = createFreshState(this.mcPin);
      console.log("[INIT] Fresh state created");
    }
  }

  // Called when a new WebSocket connection is established
  async onConnect(conn: Party.Connection) {
    this.sendTo(conn, { type: "full_state", payload: this.state });
  }

  // Called when a connection closes
  async onClose(conn: Party.Connection) {
    this.mcConnections.delete(conn.id);
  }

  // Called on every WebSocket message
  async onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return; // Ignore malformed messages
    }

    switch (msg.type) {
      case "register":
        await this.handleRegister(msg.payload, sender);
        break;
      case "reconnect":
        this.handleReconnect(msg.payload, sender);
        break;
      case "propose_song":
        await this.handleProposeSong(msg.payload, sender);
        break;
      case "mc_auth":
        this.handleMcAuth(msg.payload, sender);
        break;
      case "catalog_add":
        await this.handleCatalogAdd(msg.payload, sender);
        break;
      case "catalog_edit":
        await this.handleCatalogEdit(msg.payload);
        break;
      case "catalog_remove":
        await this.handleCatalogRemove(msg.payload);
        break;
      case "proposal_approve":
        await this.handleProposalApprove(msg.payload);
        break;
      case "proposal_reject":
        await this.handleProposalReject(msg.payload);
        break;
      case "confirm_block":
        await this.handleConfirmBlock(msg.payload);
        break;
      case "request_suggestion":
        this.handleRequestSuggestion();
        break;
      case "timer_action":
        await this.handleTimerAction(msg.payload);
        break;
      case "end_event":
        await this.handleEndEvent();
        break;
      case "queue_remove":
        await this.handleQueueRemove(msg.payload, sender);
        break;
      case "emergency_add":
        await this.handleEmergencyAdd(msg.payload, sender);
        break;
    }
  }

  // Called when a storage alarm fires
  async onAlarm() {
    await clearSnapshot(this.room);
    console.log("[ALARM] Cleanup completed");
  }

  // ─── Handlers ────────────────────────────────────────────────────

  private async handleRegister(
    payload: { alias: string; instrument: string; topSongs: string[] },
    sender: Party.Connection
  ) {
    const musician: Musician = {
      id: crypto.randomUUID(),
      alias: payload.alias,
      instrument: payload.instrument as Musician["instrument"],
      topSongs: payload.topSongs,
      proposedSongs: [],
      playCount: 0,
      registeredAt: Date.now(),
    };

    this.state.waitingQueue.push(musician);
    this.mutate();

    // Broadcast to all
    this.broadcast({ type: "musician_joined", payload: musician });

    // Force snapshot on registration (critical event)
    await saveSnapshot(this.room, this.state);
  }

  private handleReconnect(
    payload: { musicianId: string },
    sender: Party.Connection
  ) {
    // Look for the musician in waitingQueue or currentBlock
    const musician =
      this.state.waitingQueue.find((m) => m.id === payload.musicianId) ??
      (this.state.currentBlock?.musicians.some(
        (m) => m.musicianId === payload.musicianId
      )
        ? ({
            id: payload.musicianId,
            alias:
              this.state.currentBlock?.musicians.find(
                (m) => m.musicianId === payload.musicianId
              )?.alias ?? "Unknown",
            instrument:
              (this.state.currentBlock?.musicians.find(
                (m) => m.musicianId === payload.musicianId
              )?.instrument as Musician["instrument"]) ?? "guitar",
            topSongs: [],
            proposedSongs: [],
            playCount: 0,
            registeredAt: 0,
          } as Musician)
        : null);

    if (musician) {
      this.sendTo(sender, {
        type: "reconnect_ok",
        payload: { musician, fullState: this.state },
      });
    } else {
      this.sendTo(sender, { type: "identity_not_found" });
    }
  }

  private async handleProposeSong(
    payload: {
      title: string;
      artist: string;
      genre: Genre;
      youtubeUrl?: string;
    },
    sender: Party.Connection
  ) {
    // Try to find the musician who is proposing
    const senderMusician = this.state.waitingQueue.find(
      (m) => true // We don't have the musician ID from the connection
      // In a production app, you'd tag connections with musician IDs
    );

    const song = addProposal(this.state, {
      ...payload,
      addedBy: "participant",
    });

    this.mutate();

    // Notify MC connections only
    for (const connId of this.mcConnections) {
      const conn = this.room.getConnection(connId);
      if (conn) {
        this.sendTo(conn, { type: "new_proposal", payload: song });
      }
    }

    // Also broadcast so the proposer's UI updates
    this.broadcast({
      type: "catalog_updated",
      payload: { catalog: this.state.catalog },
    });
  }

  private handleMcAuth(
    payload: { pin: string },
    sender: Party.Connection
  ) {
    if (payload.pin === this.state.mcPin) {
      this.mcConnections.add(sender.id);
      this.sendTo(sender, { type: "mc_auth_ok" });
      // Send full state after auth
      this.sendTo(sender, { type: "full_state", payload: this.state });
    } else {
      this.sendTo(sender, { type: "mc_auth_fail" });
    }
  }

  private async handleCatalogAdd(
    payload: {
      title: string;
      artist: string;
      genre: Genre;
      youtubeUrl?: string;
    },
    _sender: Party.Connection
  ) {
    addSongToCatalog(this.state, payload);
    this.mutate();
    this.broadcast({
      type: "catalog_updated",
      payload: { catalog: this.state.catalog },
    });
    await saveSnapshot(this.room, this.state);
  }

  private async handleCatalogEdit(payload: {
    songId: string;
    updates: Partial<Song>;
  }) {
    editSongInCatalog(this.state, payload.songId, payload.updates);
    this.mutate();
    this.broadcast({
      type: "catalog_updated",
      payload: { catalog: this.state.catalog },
    });
  }

  private async handleCatalogRemove(payload: { songId: string }) {
    removeSongFromCatalog(this.state, payload.songId);
    this.mutate();
    this.broadcast({
      type: "catalog_updated",
      payload: { catalog: this.state.catalog },
    });
  }

  private async handleProposalApprove(payload: { songId: string }) {
    const approved = approveProposal(this.state, payload.songId);
    if (approved) {
      this.mutate();
      this.broadcast({
        type: "proposal_resolved",
        payload: { songId: payload.songId, approved: true },
      });
      this.broadcast({
        type: "catalog_updated",
        payload: { catalog: this.state.catalog },
      });
      await saveSnapshot(this.room, this.state);
    }
  }

  private async handleProposalReject(payload: { songId: string }) {
    const rejected = rejectProposal(this.state, payload.songId);
    if (rejected) {
      this.mutate();
      this.broadcast({
        type: "proposal_resolved",
        payload: { songId: payload.songId, approved: false },
      });
    }
  }

  private async handleConfirmBlock(payload: { blockIndex: number }) {
    const entry = this.state.setlistSuggested[payload.blockIndex];
    if (!entry) return;

    // Move from suggested to official
    this.state.setlistSuggested.splice(payload.blockIndex, 1);
    entry.orderIndex = this.state.setlistOfficial.length;
    this.state.setlistOfficial.push(entry);

    this.mutate();
    this.broadcast({ type: "block_confirmed", payload: entry });

    // If no current block, auto-start this one
    if (!this.state.currentBlock) {
      this.startBlock(entry);
    }

    await saveSnapshot(this.room, this.state);
  }

  private handleRequestSuggestion() {
    const suggestions = suggestLineup(this.state, 3);
    this.state.setlistSuggested = suggestions;
    this.mutate();

    // Broadcast full state so MC sees updated suggestions
    this.broadcast({ type: "full_state", payload: this.state });
  }

  private async handleTimerAction(payload: {
    action: "start" | "pause" | "reset";
  }) {
    switch (payload.action) {
      case "start":
        if (this.state.currentBlock) {
          this.state.currentBlock.status = "playing";
          this.state.currentBlock.startTime = Date.now();
          this.startTimer();
          this.broadcast({
            type: "block_started",
            payload: {
              songTitle: this.state.currentBlock.songTitle,
              musicians: this.state.currentBlock.musicians,
              startTime: this.state.currentBlock.startTime,
            },
          });
        } else if (this.state.setlistOfficial.length > 0) {
          // Start the next official block
          const next = this.state.setlistOfficial.shift()!;
          this.startBlock(next);
        }
        break;

      case "pause":
        this.stopTimer();
        if (this.state.currentBlock) {
          this.state.currentBlock.status = "transitioning";
        }
        break;

      case "reset":
        this.stopTimer();
        if (this.state.currentBlock) {
          this.state.currentBlock.startTime = Date.now();
          this.broadcast({
            type: "timer_tick",
            payload: { remaining: BLOCK_DURATION_MS / 1000 },
          });
        }
        break;
    }
  }

  private async handleQueueRemove(
    payload: { musicianId: string },
    sender: Party.Connection
  ) {
    // Only MC can remove musicians
    if (!this.mcConnections.has(sender.id)) return;

    const idx = this.state.waitingQueue.findIndex(
      (m) => m.id === payload.musicianId
    );
    if (idx === -1) return;

    this.state.waitingQueue.splice(idx, 1);
    this.mutate();

    // Broadcast removal to all clients
    this.broadcast({
      type: "musician_removed",
      payload: { musicianId: payload.musicianId },
    });

    await saveSnapshot(this.room, this.state);
    console.log(`[QUEUE] Musician ${payload.musicianId} removed by MC`);
  }

  private async handleEmergencyAdd(
    payload: { alias: string; instrument: string },
    sender: Party.Connection
  ) {
    // Only MC can emergency-add musicians
    if (!this.mcConnections.has(sender.id)) return;

    const musician: Musician = {
      id: crypto.randomUUID(),
      alias: payload.alias,
      instrument: payload.instrument as Musician["instrument"],
      topSongs: [],
      proposedSongs: [],
      playCount: 0,
      registeredAt: Date.now(),
    };

    this.state.waitingQueue.push(musician);
    this.mutate();

    this.broadcast({ type: "musician_joined", payload: musician });

    await saveSnapshot(this.room, this.state);
    console.log(`[QUEUE] Musician "${payload.alias}" emergency-added by MC`);
  }

  private async handleEndEvent() {
    this.stopTimer();

    // Complete current block if playing
    if (this.state.currentBlock) {
      this.completeCurrentBlock();
    }

    // Force final snapshot as backup
    await saveSnapshot(this.room, this.state);

    // Broadcast event ended with final state
    this.broadcast({
      type: "event_ended",
      payload: { finalState: this.state },
    });

    // Clean up storage
    await clearSnapshot(this.room);

    // Set alarm to clean up storage in 1 hour as safety net
    await this.room.storage.setAlarm(
      new Date(Date.now() + 60 * 60 * 1000)
    );

    console.log(
      `[EVENT] Ended: ${this.state.history.length} blocks, ${this.state.waitingQueue.length} musicians`
    );

    // Reset to fresh state for the next event
    this.state = createFreshState(this.mcPin);
  }

  // ─── Timer Logic ─────────────────────────────────────────────────

  private startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.state.currentBlock) {
        this.stopTimer();
        return;
      }

      const elapsed = Date.now() - this.state.currentBlock.startTime;
      const remaining = Math.max(
        0,
        Math.ceil((BLOCK_DURATION_MS - elapsed) / 1000)
      );

      this.broadcast({
        type: "timer_tick",
        payload: { remaining },
      });

      // Block time is up
      if (remaining <= 0) {
        this.completeCurrentBlock();
        this.stopTimer();

        // Auto-start next block if available
        if (this.state.setlistOfficial.length > 0) {
          const next = this.state.setlistOfficial.shift()!;
          this.startBlock(next);
        }
      }
    }, TIMER_INTERVAL_MS);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private startBlock(entry: SetlistEntry) {
    const now = Date.now();
    this.state.currentBlock = {
      songId: entry.songId,
      songTitle: entry.songTitle,
      musicians: entry.assignedMusicians,
      startTime: now,
      status: "playing",
    };

    // Remove assigned musicians from waiting queue
    const assignedIds = new Set(
      entry.assignedMusicians.map((m) => m.musicianId)
    );
    this.state.waitingQueue = this.state.waitingQueue.filter(
      (m) => !assignedIds.has(m.id)
    );

    this.mutate();
    this.startTimer();

    this.broadcast({
      type: "block_started",
      payload: {
        songTitle: entry.songTitle,
        musicians: entry.assignedMusicians,
        startTime: now,
      },
    });
  }

  private completeCurrentBlock() {
    if (!this.state.currentBlock) return;

    const block = this.state.currentBlock;
    const now = Date.now();

    const completed: CompletedBlock = {
      songId: block.songId,
      songTitle: block.songTitle,
      youtubeUrl: this.state.catalog.find((s) => s.id === block.songId)
        ?.youtubeUrl,
      musicians: block.musicians,
      startedAt: block.startTime,
      endedAt: now,
      duration: Math.round((now - block.startTime) / 1000),
    };

    this.state.history.push(completed);
    this.state.currentBlock = null;

    // Return musicians to queue with incremented playCount
    for (const assigned of block.musicians) {
      const musician = this.state.waitingQueue.find(
        (m) => m.id === assigned.musicianId
      );
      if (!musician) {
        // Re-add to queue
        this.state.waitingQueue.push({
          id: assigned.musicianId,
          alias: assigned.alias,
          instrument: assigned.instrument as Musician["instrument"],
          topSongs: [],
          proposedSongs: [],
          playCount: 1,
          registeredAt: 0,
        });
      }
    }

    // Increment playCount for musicians who played
    for (const assigned of completed.musicians) {
      const m = this.state.waitingQueue.find(
        (m) => m.id === assigned.musicianId
      );
      if (m) m.playCount++;
    }

    this.mutate();
    this.broadcast({ type: "block_completed", payload: completed });

    // Force snapshot on block completion
    saveSnapshot(this.room, this.state).catch(console.error);
  }

  // ─── Utilities ───────────────────────────────────────────────────

  private mutate() {
    this.state.version++;
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      conn.send(data);
    }
  }

  private sendTo(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }
}

// Required for PartyKit to recognize the export
JamRoom satisfies Party.Worker;
