import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionIdentity } from "../hooks/useSessionIdentity";

function getEventId(): string {
  return `jam-${new Date().toISOString().split("T")[0]}`;
}

export default function Welcome() {
  const navigate = useNavigate();
  const { getSavedIdentity } = useSessionIdentity();
  const eventId = useMemo(() => getEventId(), []);
  const savedIdentity = useMemo(() => getSavedIdentity(eventId), [eventId, getSavedIdentity]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-(--color-bg-primary) px-6">
      {/* Logo / Title */}
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-(--color-amber) sm:text-6xl">
          JAM SESSION
        </h1>
        <p className="mt-3 text-sm text-(--color-text-muted)">
          {eventId}
        </p>
      </div>

      {savedIdentity ? (
        /* Returning user */
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <p className="text-xl text-(--color-text-secondary)">
            Hola{" "}
            <span className="font-semibold text-(--color-text-primary)">
              {savedIdentity.alias}
            </span>
          </p>
          <button
            onClick={() => {
              const dest =
                savedIdentity.role === "mc"
                  ? "/mc"
                  : savedIdentity.role === "companion"
                    ? "/companion"
                    : "/participant";
              navigate(dest);
            }}
            className="w-full min-h-12 rounded-xl bg-(--color-amber) px-6 py-4 text-lg font-bold text-(--color-bg-primary) transition-colors hover:bg-(--color-amber-dark) active:scale-[0.98]"
          >
            Reconectar
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-(--color-text-muted) underline underline-offset-4 hover:text-(--color-text-secondary)"
          >
            Entrar como alguien m&aacute;s
          </button>
        </div>
      ) : (
        /* New user */
        <div className="flex w-full max-w-sm flex-col gap-4">
          <button
            onClick={() => navigate("/companion")}
            className="flex min-h-12 items-center justify-center rounded-xl border-2 border-(--color-amber)/30 bg-(--color-bg-card) px-6 py-5 text-lg font-semibold text-(--color-text-primary) transition-colors hover:border-(--color-amber) hover:bg-(--color-bg-hover) active:scale-[0.98]"
          >
            <span className="mr-3 text-2xl">🎧</span>
            Vengo a escuchar
          </button>

          <button
            onClick={() => navigate("/participant")}
            className="flex min-h-12 items-center justify-center rounded-xl bg-(--color-amber) px-6 py-5 text-lg font-bold text-(--color-bg-primary) transition-colors hover:bg-(--color-amber-dark) active:scale-[0.98]"
          >
            <span className="mr-3 text-2xl">🎸</span>
            Vengo a tocar
          </button>
        </div>
      )}

      {/* MC link */}
      <button
        onClick={() => navigate("/mc")}
        className="mt-16 text-xs text-(--color-text-muted) underline underline-offset-4 hover:text-(--color-text-secondary)"
      >
        Acceso MC
      </button>
    </div>
  );
}
