import WebSocket from "ws";

export interface WsMessage {
  type: string;
  payload?: unknown;
}

/**
 * Lightweight WebSocket client for directly communicating with PartyKit
 * in tests (bypassing the browser UI).
 */
export class TestWebSocketClient {
  private ws: WebSocket;
  private messageQueue: WsMessage[] = [];
  private waiters: Array<{
    type: string;
    resolve: (msg: WsMessage) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(roomId: string, host = "localhost:1999") {
    this.ws = new WebSocket(`ws://${host}/party/${roomId}`);

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const msg: WsMessage = JSON.parse(data.toString());

        // Check if anyone is waiting for this message type
        const waiterIdx = this.waiters.findIndex((w) => w.type === msg.type);
        if (waiterIdx !== -1) {
          const waiter = this.waiters[waiterIdx];
          clearTimeout(waiter.timeout);
          this.waiters.splice(waiterIdx, 1);
          waiter.resolve(msg);
        } else {
          this.messageQueue.push(msg);
        }
      } catch {
        // ignore malformed messages
      }
    });
  }

  waitForOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
    });
  }

  send(msg: WsMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  waitForMessage(type: string, timeoutMs = 5000): Promise<WsMessage> {
    // Check queued messages first
    const queued = this.messageQueue.findIndex((m) => m.type === type);
    if (queued !== -1) {
      const [msg] = this.messageQueue.splice(queued, 1);
      return Promise.resolve(msg);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeoutMs);

      this.waiters.push({ type, resolve, timeout });
    });
  }

  /** Drain all queued messages of a given type */
  drainMessages(type: string): WsMessage[] {
    const msgs: WsMessage[] = [];
    let idx = this.messageQueue.findIndex((m) => m.type === type);
    while (idx !== -1) {
      msgs.push(...this.messageQueue.splice(idx, 1));
      idx = this.messageQueue.findIndex((m) => m.type === type);
    }
    return msgs;
  }

  close(): void {
    this.ws.close();
    for (const w of this.waiters) {
      clearTimeout(w.timeout);
    }
    this.waiters = [];
  }
}
