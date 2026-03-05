/**
 * Centralized selectors for all views.
 * Uses Playwright-compatible selector syntax.
 */
export const sel = {
  // ─── Welcome ────────────────────────────────────────────────────
  welcome: {
    title: "h1",
    eventId: "p",
    btnCompanion: "text=Vengo a escuchar",
    btnParticipant: "text=Vengo a tocar",
    btnMcAccess: "text=Acceso MC",
    btnReconnect: "text=Reconectar",
    returningAlias: (alias: string) => `text=Hola`,
  },

  // ─── Participant ────────────────────────────────────────────────
  participant: {
    instrumentBtn: (label: string) => `button:has-text("${label}")`,
    aliasInput: 'input[placeholder="Ej: Santi, El Baterista..."]',
    btnNext: 'button:has-text("Siguiente")',
    btnBack: 'button:has-text("Atras")',

    songSearch: 'input[placeholder="Buscar cancion..."]',
    selectedCount: (n: number) =>
      `text=${n} seleccionada${n !== 1 ? "s" : ""}`,

    confirmHeading: "text=Confirmar registro",
    btnRegister: 'button:has-text("Registrarme")',
    btnBackToEdit: 'button:has-text("Volver a editar")',

    successMsg: (alias: string) => `text=Estas dentro, ${alias}!`,
    queuePosition: "text=Tu posicion en la cola",
  },

  // ─── MC Dashboard ───────────────────────────────────────────────
  mc: {
    // PIN gate
    pinHeading: "text=Acceso MC",
    pinInput: 'input[type="password"]',
    pinSubmit: 'button[type="submit"]',
    pinError: "text=PIN invalido",

    // Dashboard
    dashTitle: "text=MC Dashboard",
    tab: (label: string) => `nav button:has-text("${label}")`,

    // Live tab
    noBlock: "text=Ningun bloque activo",
    nowPlaying: "text=Tocando ahora",
    btnPlay: 'button:has-text("Play")',
    btnPause: 'button:has-text("Pausa")',
    btnReset: 'button:has-text("Reset")',
    timer: ".font-mono.text-4xl",

    // Queue tab
    queueEmpty: "text=No hay musicos en espera",
    queueCount: (n: number) =>
      `text=${n} musico${n !== 1 ? "s" : ""} en espera`,

    // Setlist tab
    noSuggestions: "text=Sin sugerencias disponibles",
    noBlocks: "text=Aun no hay bloques confirmados",
    btnSuggest: 'button:has-text("Sugerir alineacion")',
    btnConfirmBlock: 'button:has-text("Confirmar")',

    // Catalog tab
    catalogSearch: 'input[placeholder="Buscar..."]',
    genreSelect: "select",
    btnAddSong: 'button:has-text("+ Agregar")',
    editBtn: 'button:has-text("Editar")',
    removeBtn: ".text-\\(--color-red\\)",
    proposalApprove: 'button:has-text("✓")',
    proposalReject:
      '.flex.gap-1\\.5 button:has-text("✗")',

    // Song modal
    modalTitle: 'input[placeholder="Titulo *"]',
    modalArtist: 'input[placeholder="Artista *"]',
    modalGenre: "form select",
    modalYoutube: 'input[placeholder="Link YouTube (opcional)"]',
    modalSave: 'form button[type="submit"]',
    modalCancel: 'button:has-text("Cancelar")',
    modalThumbnail: 'img[alt="YouTube preview"]',

    // Export tab
    btnEndEvent: 'button:has-text("Finalizar Evento")',
  },

  // ─── Companion ──────────────────────────────────────────────────
  companion: {
    connecting: "text=Conectando...",
    waiting: "text=Esperando que inicie el evento...",
    upcoming: "text=Próximas canciones",
    liveHeader: "text=En vivo",
    onStage: "text=En escena",
    connected: "text=Conectado",
  },
};
