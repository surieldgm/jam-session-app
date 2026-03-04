import { test as base, type BrowserContext, type Page } from "@playwright/test";

type MultiUserFixtures = {
  mcContext: BrowserContext;
  mcPage: Page;
  participantContext: BrowserContext;
  participantPage: Page;
  companionContext: BrowserContext;
  companionPage: Page;
};

export const test = base.extend<MultiUserFixtures>({
  mcContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },
  mcPage: async ({ mcContext }, use) => {
    const page = await mcContext.newPage();
    await use(page);
  },
  participantContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },
  participantPage: async ({ participantContext }, use) => {
    const page = await participantContext.newPage();
    await use(page);
  },
  companionContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },
  companionPage: async ({ companionContext }, use) => {
    const page = await companionContext.newPage();
    await use(page);
  },
});

export { expect } from "@playwright/test";
