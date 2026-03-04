import { test, expect } from "@playwright/test";
import { MC_PIN, getTodayEventId } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("MC Dashboard – Setlist tab", () => {
  let ws: TestWebSocketClient;

  test.beforeAll(async () => {
    // Reset room state before running the suite
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();
  });

  test.beforeEach(async ({ page }) => {
    // Authenticate MC: go to /mc, enter PIN, submit, wait for dashboard
    await page.goto("/mc");
    await page.locator('input[type="password"]').fill(MC_PIN);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("MC Dashboard")).toBeVisible({ timeout: 5000 });

    // Navigate to Setlist tab
    await page.locator('nav button:has-text("Setlist")').click();
    await expect(page.getByText("Sugerencias del algoritmo")).toBeVisible({
      timeout: 5000,
    });
  });

  test.afterAll(async () => {
    // Clean up: end event via WebSocket
    const cleanup = new TestWebSocketClient(getTodayEventId());
    await cleanup.waitForOpen();
    await cleanup.waitForMessage("full_state", 5000);
    cleanup.send({ type: "end_event" });
    // Give the server a moment to process the event end
    await new Promise((r) => setTimeout(r, 1000));
    cleanup.close();
  });

  test("shows empty initial state with no suggestions and no confirmed blocks", async ({
    page,
  }) => {
    await expect(page.getByText("Sin sugerencias disponibles")).toBeVisible();
    await expect(page.getByText("Aun no hay bloques confirmados")).toBeVisible();
  });

  test('"Sugerir alineacion" button is clickable and sends request_suggestion', async ({
    page,
  }) => {
    const suggestButton = page.locator(
      'button:has-text("Sugerir alineacion")'
    );
    await expect(suggestButton).toBeVisible();
    await expect(suggestButton).toBeEnabled();

    // Click the button – without musicians in the queue it may not produce
    // suggestions, but the button should be interactive and not throw errors
    await suggestButton.click();

    // Since there are no musicians in the queue, suggestions should still be empty
    await expect(page.getByText("Sin sugerencias disponibles")).toBeVisible();
  });

  test("shows suggestion entries with musician names after registering drummer and bassist", async ({
    page,
  }) => {
    // Register musicians via WebSocket
    ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    await ws.waitForMessage("full_state", 5000);

    ws.send({
      type: "register",
      payload: { alias: "Test Drummer", instrument: "drums", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    ws.send({
      type: "register",
      payload: { alias: "Test Bassist", instrument: "bass", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    // Wait for the UI to reflect the new queue state
    await page.waitForTimeout(1000);

    // Request suggestions via the UI
    await page.locator('button:has-text("Sugerir alineacion")').click();

    // Wait for suggestion entries to appear (they contain a "Confirmar" button)
    await expect(
      page.locator('button:has-text("Confirmar")').first()
    ).toBeVisible({ timeout: 10000 });

    // Verify musician names appear in the suggestion entries
    await expect(page.getByText("Test Drummer")).toBeVisible();
    await expect(page.getByText("Test Bassist")).toBeVisible();

    ws.close();
  });

  test("confirming a suggestion moves the block to the official setlist", async ({
    page,
  }) => {
    // Register musicians via WebSocket
    ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    await ws.waitForMessage("full_state", 5000);

    ws.send({
      type: "register",
      payload: { alias: "Test Drummer", instrument: "drums", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    ws.send({
      type: "register",
      payload: { alias: "Test Bassist", instrument: "bass", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    // Wait for queue state sync
    await page.waitForTimeout(1000);

    // Request suggestions
    await page.locator('button:has-text("Sugerir alineacion")').click();

    // Wait for a suggestion with "Confirmar" button
    const confirmBtn = page.locator('button:has-text("Confirmar")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });

    // Capture the song title from the suggestion entry before confirming
    const suggestionEntry = page
      .locator('button:has-text("Confirmar")')
      .first()
      .locator("..");
    const songTitleEl = suggestionEntry.locator(
      "p.text-sm.font-medium"
    );
    const songTitle = await songTitleEl.textContent();
    expect(songTitle).toBeTruthy();

    // Confirm the suggestion
    await confirmBtn.click();

    // The "Setlist oficial" section should no longer show "Aun no hay bloques confirmados"
    await expect(
      page.getByText("Aun no hay bloques confirmados")
    ).not.toBeVisible({ timeout: 5000 });

    // The song title should now appear under the official setlist section
    // The official setlist entries have a numbered badge (rounded-full) preceding the song info
    const officialSection = page.locator("text=Setlist oficial").locator("..");
    await expect(officialSection.getByText(songTitle!)).toBeVisible({
      timeout: 5000,
    });

    ws.close();
  });

  test("confirmed block auto-starts if no current block is playing", async ({
    page,
  }) => {
    // Register musicians via WebSocket
    ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    await ws.waitForMessage("full_state", 5000);

    ws.send({
      type: "register",
      payload: { alias: "Test Drummer", instrument: "drums", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    ws.send({
      type: "register",
      payload: { alias: "Test Bassist", instrument: "bass", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    // Wait for queue state sync
    await page.waitForTimeout(1000);

    // Request suggestions
    await page.locator('button:has-text("Sugerir alineacion")').click();

    // Wait for a suggestion
    const confirmBtn = page.locator('button:has-text("Confirmar")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });

    // Confirm the block
    await confirmBtn.click();

    // Wait for state to propagate
    await page.waitForTimeout(1500);

    // Switch to "En Vivo" tab to verify the block auto-started
    await page.locator('nav button:has-text("En Vivo")').click();

    // The "Tocando ahora" label should be visible, confirming the block started
    await expect(page.getByText("Tocando ahora")).toBeVisible({
      timeout: 10000,
    });

    // Also verify the "Ningun bloque activo" message is NOT shown
    await expect(page.getByText("Ningun bloque activo")).not.toBeVisible();

    ws.close();
  });
});
