import { useState, useEffect, useRef, useCallback } from "react";
import PartySocket from "partysocket";
import type { JamState, ClientMessage, ServerMessage, Musician, Song } from "../types";

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";

interface UsePartySocketOptions {
  eventId: string;
}

interface UsePartySocketReturn {
  state: JamState | null;
  send: (msg: ClientMessage) => void;
  isConnected: boolean;
}

export function usePartySocket({ eventId }: UsePartySocketOptions): UsePartySocketReturn {
  const [state, setState] = useState<JamState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: eventId,
    });

    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setIsConnected(true);
    });

    socket.addEventListener("close", () => {
      setIsConnected(false);
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    });

    function handleMessage(msg: ServerMessage) {
      switch (msg.type) {
        case "full_state":
          setState(msg.payload);
          break;

        case "reconnect_ok":
          setState(msg.payload.fullState);
          break;

        case "musician_joined":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              waitingQueue: [...prev.waitingQueue, msg.payload as Musician],
              version: prev.version + 1,
            };
          });
          break;

        case "catalog_updated":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              catalog: msg.payload.catalog as Song[],
              version: prev.version + 1,
            };
          });
          break;

        case "new_proposal":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              pendingProposals: [...prev.pendingProposals, msg.payload as Song],
              version: prev.version + 1,
            };
          });
          break;

        case "proposal_resolved":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              pendingProposals: prev.pendingProposals.filter(
                (s) => s.id !== msg.payload.songId
              ),
              version: prev.version + 1,
            };
          });
          break;

        case "block_confirmed":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              setlistOfficial: [...prev.setlistOfficial, msg.payload],
              version: prev.version + 1,
            };
          });
          break;

        case "block_started":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              currentBlock: {
                songId: "",
                songTitle: msg.payload.songTitle,
                musicians: msg.payload.musicians,
                startTime: msg.payload.startTime,
                status: "playing",
              },
              version: prev.version + 1,
            };
          });
          break;

        case "timer_tick":
          // Timer tick is informational; components can use state.currentBlock.startTime
          // or we store remaining time on state if needed
          setState((prev) => {
            if (!prev) return prev;
            return { ...prev, _timerRemaining: msg.payload.remaining } as JamState;
          });
          break;

        case "block_completed":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              currentBlock: null,
              history: [...prev.history, msg.payload],
              version: prev.version + 1,
            };
          });
          break;

        case "event_ended":
          setState(msg.payload.finalState);
          break;

        // mc_auth_ok, mc_auth_fail, identity_not_found handled by callers
        default:
          break;
      }
    }

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [eventId]);

  const send = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { state, send, isConnected };
}
