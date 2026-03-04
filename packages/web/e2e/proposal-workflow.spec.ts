import { test, expect } from "./fixtures/multi-user";
import { MC_PIN, getTodayEventId } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("Proposal workflow between participant and MC", () => {
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

  test("participant proposes a song via WebSocket", async ({ mcPage }) => {
    // Authenticate MC first so the dashboard is ready
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // Switch to Catalogo tab
    await mcPage.click('nav button:has-text("Catalogo")');
    await mcPage.waitForTimeout(500);

    // Open WebSocket as participant and send a proposal
    ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    ws.send({
      type: "propose_song",
      payload: {
        title: "Proposal Test Song",
        artist: "Test Artist",
        genre: "jazz",
      },
    });

    // Wait for the server to process the proposal
    await mcPage.waitForTimeout(2000);
  });

  test("MC sees proposal in Propuestas pendientes with badge counter", async ({
    mcPage,
  }) => {
    // Navigate and authenticate
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // Switch to Catalogo tab
    await mcPage.click('nav button:has-text("Catalogo")');
    await mcPage.waitForTimeout(1000);

    // The "Propuestas pendientes" section should be visible
    await expect(mcPage.getByText("Propuestas pendientes")).toBeVisible();

    // The proposal should show the song title and artist
    await expect(mcPage.getByText("Proposal Test Song")).toBeVisible();
    await expect(mcPage.getByText("Test Artist")).toBeVisible();

    // Badge counter should show at least 1
    const badge = mcPage.locator(
      "h3:has-text('Propuestas pendientes') span.rounded-full"
    );
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(Number(badgeText?.trim())).toBeGreaterThanOrEqual(1);
  });

  test("MC approves proposal and song appears in catalog", async ({
    mcPage,
  }) => {
    // Navigate and authenticate
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // Switch to Catalogo tab
    await mcPage.click('nav button:has-text("Catalogo")');
    await mcPage.waitForTimeout(1000);

    // Verify the proposal is visible
    await expect(mcPage.getByText("Proposal Test Song")).toBeVisible();

    // Get initial catalog count from the "Catalogo (N)" heading
    const catalogHeading = mcPage.locator("h3:has-text('Catalogo (')");
    const headingBefore = await catalogHeading.textContent();
    const countBefore = Number(headingBefore?.match(/\((\d+)\)/)?.[1] ?? 0);

    // Click approve button (✓) on the first proposal
    await mcPage.click('button:has-text("✓")');
    await mcPage.waitForTimeout(1500);

    // The proposal should no longer be in pending proposals
    // (if no more proposals, the section disappears entirely)
    const proposalSong = mcPage.getByText("Proposal Test Song");

    // The song should now be in the catalog list
    // Search for it to confirm
    await mcPage.fill('input[placeholder="Buscar..."]', "Proposal Test Song");
    await mcPage.waitForTimeout(500);
    await expect(proposalSong).toBeVisible();

    // Clear search to verify catalog count increased
    await mcPage.fill('input[placeholder="Buscar..."]', "");
    await mcPage.waitForTimeout(500);
    const headingAfter = await catalogHeading.textContent();
    const countAfter = Number(headingAfter?.match(/\((\d+)\)/)?.[1] ?? 0);
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test("MC rejects a second proposal and it disappears from pending", async ({
    mcPage,
  }) => {
    // Send a second proposal via WebSocket
    const ws2 = new TestWebSocketClient(getTodayEventId());
    await ws2.waitForOpen();
    ws2.send({
      type: "propose_song",
      payload: {
        title: "Rejected Song",
        artist: "Reject Artist",
        genre: "blues",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ws2.close();

    // Navigate and authenticate
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // Switch to Catalogo tab
    await mcPage.click('nav button:has-text("Catalogo")');
    await mcPage.waitForTimeout(1000);

    // Verify the rejected song proposal is visible
    await expect(mcPage.getByText("Rejected Song")).toBeVisible();
    await expect(mcPage.getByText("Propuestas pendientes")).toBeVisible();

    // Click the reject button (✗) on the "Rejected Song" proposal
    const proposalRow = mcPage.locator(
      'div:has-text("Rejected Song") >> .flex.gap-1\\.5 button:has-text("✗")'
    );
    await proposalRow.first().click();
    await mcPage.waitForTimeout(1500);

    // The rejected song should no longer be visible in pending proposals
    await expect(mcPage.getByText("Rejected Song")).not.toBeVisible();
  });

  test("after approval the catalog count increases", async ({ mcPage }) => {
    // Navigate and authenticate
    await mcPage.goto("/mc");
    await mcPage.fill('input[type="password"]', MC_PIN);
    await mcPage.click('button[type="submit"]');
    await expect(mcPage.getByText("MC Dashboard")).toBeVisible();

    // Switch to Catalogo tab
    await mcPage.click('nav button:has-text("Catalogo")');
    await mcPage.waitForTimeout(1000);

    // Read current catalog count
    const catalogHeading = mcPage.locator("h3:has-text('Catalogo (')");
    const headingText = await catalogHeading.textContent();
    const countBefore = Number(headingText?.match(/\((\d+)\)/)?.[1] ?? 0);

    // Send another proposal
    const ws3 = new TestWebSocketClient(getTodayEventId());
    await ws3.waitForOpen();
    ws3.send({
      type: "propose_song",
      payload: {
        title: "Count Test Song",
        artist: "Count Artist",
        genre: "funk",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ws3.close();

    // Wait for the proposal to appear
    await mcPage.waitForTimeout(1000);
    await expect(mcPage.getByText("Count Test Song")).toBeVisible({
      timeout: 5000,
    });

    // Approve it
    const approveBtn = mcPage.locator(
      'div:has-text("Count Test Song") button:has-text("✓")'
    );
    await approveBtn.first().click();
    await mcPage.waitForTimeout(1500);

    // Verify catalog count increased
    const headingAfter = await catalogHeading.textContent();
    const countAfter = Number(headingAfter?.match(/\((\d+)\)/)?.[1] ?? 0);
    expect(countAfter).toBe(countBefore + 1);
  });

  test.afterAll(async () => {
    // Close any lingering WebSocket connections
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
