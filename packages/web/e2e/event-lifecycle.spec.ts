import { test, expect } from "./fixtures/multi-user";
import { MC_PIN, getTodayEventId } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("Event lifecycle - golden path", () => {
  test.beforeAll(async () => {
    // Reset event state before running the suite
    const resetWs = new TestWebSocketClient(getTodayEventId());
    await resetWs.waitForOpen();
    resetWs.send({ type: "mc_auth", payload: { pin: MC_PIN } });
    resetWs.send({ type: "end_event" });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    resetWs.close();
  });

  test("complete event lifecycle from authentication to stats", async ({
    mcPage,
    participantPage,
    companionPage,
  }) => {
    // ─── Step 1: MC authenticates ────────────────────────────────────
    await mcPage.goto("/mc");
    await expect(mcPage.getByText("Acceso MC")).toBeVisible();

    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');

    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // ─── Step 2: Musician A registers via participant page ───────────
    await participantPage.goto("/participant");

    // Step 2a: Select instrument (Bateria = drums)
    await participantPage.getByText("Bateria").click();

    // Step 2b: Enter alias
    await participantPage.fill(
      'input[placeholder="Ej: Santi, El Baterista..."]',
      "Drummer Alex"
    );

    // Step 2c: Click Siguiente to go to step 2 (song selection)
    await participantPage.getByText("Siguiente").click();

    // Step 2d: Select some songs (click first few available)
    await participantPage.waitForTimeout(1000);
    const songButtons = participantPage.locator(
      'button:has-text("Seleccionar")'
    );
    const songCount = await songButtons.count();
    if (songCount > 0) {
      await songButtons.first().click();
    }

    // Step 2e: Click Siguiente to go to step 3 (confirmation)
    await participantPage.getByText("Siguiente").click();

    // Step 2f: Confirm registration
    await expect(
      participantPage.getByText("Confirmar registro")
    ).toBeVisible();
    await participantPage.getByText("Registrarme").click();

    // Step 2g: Verify success screen
    await expect(
      participantPage.getByText("Estas dentro, Drummer Alex!")
    ).toBeVisible();

    // ─── Step 3: Musician B registers via WebSocket ─────────────────
    const ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    ws.send({
      type: "register",
      payload: {
        alias: "Bassist Bob",
        instrument: "bass",
        topSongs: [],
      },
    });
    // Wait for server to process the registration
    await ws.waitForMessage("full_state", 5000);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ─── Step 4: MC sees 2 musicians in Cola ────────────────────────
    await mcPage.click('nav button:has-text("Cola")');
    await mcPage.waitForTimeout(1500);

    // Verify both musicians appear (use .first() in case of multiple matches)
    await expect(mcPage.getByText("Drummer Alex").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(mcPage.getByText("Bassist Bob").first()).toBeVisible({
      timeout: 5000,
    });

    // Verify the queue count shows at least 2 musicians
    const queueText = await mcPage.locator('main p:has-text("musico")').first().textContent();
    const countMatch = queueText?.match(/(\d+)\s+musico/);
    expect(Number(countMatch?.[1])).toBeGreaterThanOrEqual(2);

    // ─── Step 5: MC requests suggestion ─────────────────────────────
    await mcPage.click('nav button:has-text("Setlist")');
    await mcPage.waitForTimeout(500);

    await mcPage.click('button:has-text("Sugerir alineacion")');

    // Wait for suggestions to appear from the algorithm
    await mcPage.waitForTimeout(3000);

    // ─── Step 6: Suggestions show musicians ─────────────────────────
    // The suggestions section should have entries with musician names
    const suggestionEntries = mcPage.locator(
      'button:has-text("Confirmar")'
    );
    await expect(suggestionEntries.first()).toBeVisible({ timeout: 10000 });

    // Verify that at least one musician name appears in the suggestion area
    const setlistContent = await mcPage
      .locator("main")
      .textContent();
    const hasDrummer = setlistContent?.includes("Drummer Alex");
    const hasBassist = setlistContent?.includes("Bassist Bob");
    expect(hasDrummer || hasBassist).toBe(true);

    // ─── Step 7: MC confirms first block ────────────────────────────
    await suggestionEntries.first().click();
    await mcPage.waitForTimeout(2000);

    // Block should auto-start since there is no current block
    // Switch to En Vivo to verify
    await mcPage.click('nav button:has-text("En Vivo")');
    await mcPage.waitForTimeout(1000);

    // Should see "Tocando ahora" indicating a block is active
    await expect(mcPage.getByText("Tocando ahora")).toBeVisible({
      timeout: 5000,
    });

    // ─── Step 8: Companion sees the block ───────────────────────────
    await companionPage.goto("/companion");
    await companionPage.waitForTimeout(3000);

    // Companion should show the song title in the h1
    const songTitle = companionPage.locator("h1").first();
    await expect(songTitle).toBeVisible({ timeout: 5000 });
    const titleText = await songTitle.textContent();
    expect(titleText?.length).toBeGreaterThan(0);

    // "En escena" section should show the musicians
    await expect(companionPage.getByText("En escena")).toBeVisible({
      timeout: 5000,
    });

    // At least one musician badge should be visible
    const musicianBadges = companionPage.locator(
      ".flex.flex-wrap.gap-2 > div"
    );
    const badgeCount = await musicianBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // ─── Step 9: MC controls timer ──────────────────────────────────
    // Already on En Vivo tab
    const timer = mcPage.locator(".font-mono.text-4xl");
    await expect(timer).toBeVisible({ timeout: 5000 });

    // Play and Pausa buttons should be visible
    await expect(mcPage.getByText("Play")).toBeVisible();
    await expect(mcPage.getByText("Pausa")).toBeVisible();

    // ─── Step 10: MC ends event ─────────────────────────────────────
    await mcPage.click('nav button:has-text("Exportar")');
    await mcPage.waitForTimeout(500);

    await mcPage.click('button:has-text("Finalizar Evento")');
    await mcPage.waitForTimeout(3000);

    // ─── Step 11: Stats show results ────────────────────────────────
    // After ending, the Exportar tab should display stats
    await expect(mcPage.getByText("Bloques tocados")).toBeVisible({
      timeout: 5000,
    });

    // Stats should show at least 1 block (may be more from accumulated test state)
    const blocksCard = mcPage.locator(
      'div:has(p:has-text("Bloques tocados"))'
    );
    const blocksValue = blocksCard.locator("p.text-2xl").first();
    const blocksText = await blocksValue.textContent();
    expect(Number(blocksText)).toBeGreaterThanOrEqual(1);

    // Musicos registrados should be visible
    await expect(mcPage.getByText("Musicos registrados")).toBeVisible();

    // Clean up the WebSocket
    ws.close();
  });

  test.afterAll(async () => {
    try {
      const ws = new TestWebSocketClient(getTodayEventId());
      await ws.waitForOpen();
      ws.send({ type: "mc_auth", payload: { pin: MC_PIN } });
      ws.send({ type: "end_event" });
      await ws.waitForMessage("event_ended", 5000);
      ws.close();
    } catch {
      /* may already be ended */
    }
  });
});
