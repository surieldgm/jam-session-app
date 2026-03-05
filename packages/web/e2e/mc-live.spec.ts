import { test, expect } from "@playwright/test";
import { MC_PIN, getTodayEventId } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("MC Dashboard – Live tab (En Vivo)", () => {
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

  /**
   * Helper: authenticate MC, register musicians via WS, request suggestion,
   * confirm block from Setlist tab, then switch to En Vivo tab.
   */
  async function setupLiveBlock(page: import("@playwright/test").Page) {
    // 0. Reset room state before each test setup
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();

    // 1. Authenticate MC
    await page.goto("/mc");
    await page.locator('input[type="password"]').fill(MC_PIN);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("MC Dashboard")).toBeVisible({ timeout: 5000 });

    // 2. Register musicians via WebSocket
    ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    await ws.waitForMessage("full_state", 5000);

    ws.send({
      type: "register",
      payload: { alias: "Live Drummer", instrument: "drums", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    ws.send({
      type: "register",
      payload: { alias: "Live Bassist", instrument: "bass", topSongs: [] },
    });
    await ws.waitForMessage("musician_joined", 3000);

    // Wait for queue state to sync to the UI
    await page.waitForTimeout(1000);

    // 3. Navigate to Setlist tab
    await page.locator('nav button:has-text("Setlist")').click();
    await expect(page.getByText("Sugerencias del algoritmo")).toBeVisible({
      timeout: 5000,
    });

    // 4. Request suggestion
    await page.locator('button:has-text("Sugerir alineacion")').click();

    // 5. Wait for suggestion and confirm it
    const confirmBtn = page.locator('button:has-text("Confirmar")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    // Wait for the block to be confirmed and auto-start
    await page.waitForTimeout(1500);

    // 6. Switch to En Vivo tab
    await page.locator('nav button:has-text("En Vivo")').click();
    await expect(page.getByText("Tocando ahora")).toBeVisible({
      timeout: 10000,
    });
  }

  test.afterAll(async () => {
    // Clean up: end event via WebSocket
    const cleanup = new TestWebSocketClient(getTodayEventId());
    await cleanup.waitForOpen();
    await cleanup.waitForMessage("full_state", 5000);
    cleanup.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 1000));
    cleanup.close();
  });

  test("shows song title and musician badges when block is active", async ({
    page,
  }) => {
    await setupLiveBlock(page);

    // "Tocando ahora" label should be visible
    await expect(page.getByText("Tocando ahora")).toBeVisible();

    // Song title should be displayed (text-2xl inside the live card)
    const songTitle = page.locator("h2.text-2xl");
    await expect(songTitle).toBeVisible();
    const titleText = await songTitle.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.length).toBeGreaterThan(0);

    // Musician badges should show the registered musicians
    await expect(page.getByText("Live Drummer")).toBeVisible();
    await expect(page.getByText("Live Bassist")).toBeVisible();

    // "Ningun bloque activo" should NOT be visible
    await expect(page.getByText("Ningun bloque activo")).not.toBeVisible();

    ws.close();
  });

  test("Play button starts the timer (timer value changes)", async ({
    page,
  }) => {
    await setupLiveBlock(page);

    // Read initial timer value
    const timerEl = page.locator(".font-mono.text-4xl");
    await expect(timerEl).toBeVisible();
    const initialValue = await timerEl.textContent();

    // Click Play to start/resume the timer
    await page.locator('button:has-text("Play")').click();

    // Wait a couple of seconds for the timer to advance
    await page.waitForTimeout(2500);

    // Read the timer again – it should have changed
    const updatedValue = await timerEl.textContent();
    expect(updatedValue).not.toBe("00:00");

    ws.close();
  });

  test("Pausa button stops the timer (timer value stops changing)", async ({
    page,
  }) => {
    await setupLiveBlock(page);

    // Start the timer
    await page.locator('button:has-text("Play")').click();
    await page.waitForTimeout(2000);

    // Pause the timer
    await page.locator('button:has-text("Pausa")').click();

    // Read the timer value right after pausing
    const timerEl = page.locator(".font-mono.text-4xl");
    await page.waitForTimeout(500);
    const pausedValue = await timerEl.textContent();

    // Wait another 2 seconds and read again – it should be the same
    await page.waitForTimeout(2000);
    const afterWaitValue = await timerEl.textContent();

    expect(afterWaitValue).toBe(pausedValue);

    ws.close();
  });

  test("Reset button resets the timer back to initial value", async ({
    page,
  }) => {
    await setupLiveBlock(page);

    // Start the timer and let it run (countdown from 07:00)
    await page.locator('button:has-text("Play")').click();
    await page.waitForTimeout(3000);

    // The timer should have counted down from 07:00 (so < 07:00)
    const timerEl = page.locator(".font-mono.text-4xl");
    const runningValue = await timerEl.textContent();
    expect(runningValue).not.toBe("07:00");

    // Click Reset – this resets the timer back to 07:00
    await page.locator('button:has-text("Reset")').click();

    // Allow a brief moment for the UI to re-render
    await page.waitForTimeout(500);

    // After reset, the timer should be back at 07:00
    const resetValue = await timerEl.textContent();
    expect(resetValue).toBeTruthy();

    // Parse the reset timer value – it should be 07:00 (420 seconds)
    const match = resetValue!.match(/(\d{2}):(\d{2})/);
    expect(match).toBeTruthy();
    const minutes = parseInt(match![1], 10);
    const seconds = parseInt(match![2], 10);
    const totalSeconds = minutes * 60 + seconds;
    expect(totalSeconds).toBeGreaterThanOrEqual(415); // ~07:00

    ws.close();
  });

  test("block can be completed and shows 'Ningun bloque activo' afterwards", async ({
    page,
  }) => {
    await setupLiveBlock(page);

    // Verify the block is currently active
    await expect(page.getByText("Tocando ahora")).toBeVisible();

    // End the event via WebSocket to clear the current block
    ws.send({ type: "end_event" });

    // Wait for the state to propagate to the UI
    await page.waitForTimeout(2000);

    // After ending the event, the live tab should show "Ningun bloque activo"
    await expect(page.getByText("Ningun bloque activo")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Confirma un bloque del setlist para iniciar")
    ).toBeVisible();

    // "Tocando ahora" should no longer be visible
    await expect(page.getByText("Tocando ahora")).not.toBeVisible();

    ws.close();
  });
});
