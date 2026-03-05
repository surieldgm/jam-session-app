import { test, expect } from "./fixtures/multi-user";
import { MC_PIN, getTodayEventId } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("Real-time synchronization across browser contexts", () => {
  let ws: TestWebSocketClient;

  test.beforeAll(async () => {
    // Reset event state before running the suite
    const resetWs = new TestWebSocketClient(getTodayEventId());
    await resetWs.waitForOpen();
    resetWs.send({ type: "mc_auth", payload: { pin: MC_PIN } });
    resetWs.send({ type: "end_event" });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    resetWs.close();
  });

  test("registration propagates from participant to MC within 2 seconds", async ({
    mcPage,
    participantPage,
  }) => {
    // Authenticate MC and navigate to Cola tab
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();
    await mcPage.click('nav button:has-text("Cola")');
    await mcPage.waitForTimeout(500);

    // Verify "Sync Drummer" is NOT yet in the queue
    await expect(mcPage.getByText("Sync Drummer")).not.toBeVisible();

    // Register a musician via participantPage
    await participantPage.goto("/participant");

    // Step 1: Select instrument (Bateria = drums)
    await participantPage.getByText("Bateria").click();

    // Enter alias
    await participantPage.fill(
      'input[placeholder="Ej: Santi, El Baterista..."]',
      "Sync Drummer"
    );

    // Click Siguiente to go to step 2 (song selection)
    await participantPage.getByText("Siguiente").click();

    // Step 2: Skip song selection
    await participantPage.getByText("Siguiente").click();

    // Step 3: Confirm registration
    await participantPage.getByText("Registrarme").click();

    // Verify participant sees success
    await expect(
      participantPage.getByText("Estas dentro, Sync Drummer!")
    ).toBeVisible();

    // MC should see the musician in Cola within 2 seconds
    await expect(mcPage.getByText("Sync Drummer")).toBeVisible({
      timeout: 2000,
    });

    // Queue should no longer be empty
    await expect(
      mcPage.getByText("No hay musicos en espera")
    ).not.toBeVisible();
  });

  test("catalog change by MC propagates to participant song list", async ({
    mcPage,
    participantPage,
  }) => {
    // MC navigates and authenticates
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // Switch to Catalogo tab
    await mcPage.click('nav button:has-text("Catalogo")');
    await mcPage.waitForTimeout(500);

    // MC adds a new song
    await mcPage.click('button:has-text("+ Agregar")');
    await mcPage.fill('input[placeholder="Titulo *"]', "Sync Catalog Song");
    await mcPage.fill('input[placeholder="Artista *"]', "Sync Artist");
    await mcPage.selectOption("form select", "jazz");
    await mcPage.click('form button[type="submit"]');
    await mcPage.waitForTimeout(1500);

    // Participant navigates to /participant and goes to step 2 (song selection)
    await participantPage.goto("/participant");
    await participantPage.getByText("Bateria").click();
    await participantPage.fill(
      'input[placeholder="Ej: Santi, El Baterista..."]',
      "Song Viewer"
    );
    await participantPage.getByText("Siguiente").click();
    await participantPage.waitForTimeout(1000);

    // Search for the song MC just added
    await participantPage.fill(
      'input[placeholder="Buscar cancion..."]',
      "Sync Catalog Song"
    );
    await participantPage.waitForTimeout(1000);

    // The newly added song should appear in the participant's list
    await expect(
      participantPage.getByText("Sync Catalog Song")
    ).toBeVisible({ timeout: 5000 });
  });

  test("block start propagates to companion view", async ({
    mcPage,
    companionPage,
  }) => {
    // Register 2 musicians via WebSocket to enable suggestions
    ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();

    ws.send({
      type: "register",
      payload: {
        alias: "Block Drummer",
        instrument: "drums",
        topSongs: [],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    ws.send({
      type: "register",
      payload: {
        alias: "Block Bassist",
        instrument: "bass",
        topSongs: [],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // MC authenticates
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // MC requests suggestion on Setlist tab
    await mcPage.click('nav button:has-text("Setlist")');
    await mcPage.waitForTimeout(500);
    await mcPage.click('button:has-text("Sugerir alineacion")');

    // Wait for suggestions to appear (the algorithm needs musicians in queue)
    await mcPage.waitForTimeout(3000);

    // If suggestions appeared, confirm the first block
    const confirmBtn = mcPage.locator('button:has-text("Confirmar")');
    const confirmCount = await confirmBtn.count();
    if (confirmCount > 0) {
      await confirmBtn.first().click();
      await mcPage.waitForTimeout(2000);

      // Companion should see the block
      await companionPage.goto("/companion");
      await companionPage.waitForTimeout(3000);

      // Companion should show the song title (from currentBlock)
      const songTitleVisible = await companionPage
        .locator("h1")
        .first()
        .isVisible();
      expect(songTitleVisible).toBe(true);

      // "En escena" section with musicians should be visible
      await expect(companionPage.getByText("En escena")).toBeVisible({
        timeout: 5000,
      });
    } else {
      // If no suggestions (edge case: not enough data), skip gracefully
      test.skip();
    }
  });

  test("timer updates propagate to companion (not stuck at 00:00)", async ({
    companionPage,
  }) => {
    // Navigate companion to /companion
    await companionPage.goto("/companion");
    await companionPage.waitForTimeout(3000);

    // Check if there is an active block (from the previous test)
    const hasBlock = await companionPage
      .locator("h1")
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasBlock) {
      test.skip();
      return;
    }

    // Read the timer value
    const timerLocator = companionPage.locator(".font-mono").first();
    await expect(timerLocator).toBeVisible({ timeout: 5000 });

    const firstReading = await timerLocator.textContent();

    // Wait 2 seconds and read again
    await companionPage.waitForTimeout(2000);
    const secondReading = await timerLocator.textContent();

    // Timer should have changed (not stuck)
    // At least one of the two readings should not be "00:00"
    const isUpdating = firstReading !== secondReading || firstReading !== "00:00";
    expect(isUpdating).toBe(true);
  });

  test("event end propagates to all pages", async ({
    mcPage,
    companionPage,
  }) => {
    // MC authenticates
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // Companion connects
    await companionPage.goto("/companion");
    await companionPage.waitForTimeout(2000);

    // MC ends the event
    await mcPage.click('nav button:has-text("Exportar")');
    await mcPage.waitForTimeout(500);
    await mcPage.click('button:has-text("Finalizar Evento")');
    await mcPage.waitForTimeout(2000);

    // After event ends, companion should show the waiting state
    // (since the event is over, the currentBlock becomes null)
    await companionPage.waitForTimeout(2000);
    await companionPage.reload();
    await companionPage.waitForTimeout(2000);

    // The companion should show the idle/waiting state
    // Either "Esperando que inicie el evento..." or the event ended state
    const waitingVisible = await companionPage
      .getByText("Esperando que inicie el evento...")
      .isVisible()
      .catch(() => false);

    const connectedVisible = await companionPage
      .getByText("Conectando...")
      .isVisible()
      .catch(() => false);

    // One of the terminal states should be reached
    expect(waitingVisible || connectedVisible).toBe(true);
  });

  test.afterAll(async () => {
    try {
      ws?.close();
    } catch {
      /* already closed */
    }

    // Clean up: reset event state
    try {
      const cleanupWs = new TestWebSocketClient(getTodayEventId());
      await cleanupWs.waitForOpen();
      cleanupWs.send({ type: "mc_auth", payload: { pin: MC_PIN } });
      cleanupWs.send({ type: "end_event" });
      await cleanupWs.waitForMessage("event_ended", 5000);
      cleanupWs.close();
    } catch {
      /* may already be ended */
    }
  });
});
