import { test, expect } from "@playwright/test";

import {
  attachPageDebug,
  ensureUnlocked,
  expectEventuallyVisibleInChat,
  login,
  openChatWith,
  register,
  sendMessage,
  uniqueUser,
} from "./helpers";

test.describe("chat continuity", () => {
  test.setTimeout(180_000);

  test("alternating 20 messages keeps working (ratchet over time)", async ({ browser }) => {
    const password = "Testpass1!";
    const alice = uniqueUser("alice");
    const bob = uniqueUser("bob");

    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const bobPage = await bobCtx.newPage();
    attachPageDebug(alicePage, "alice");
    attachPageDebug(bobPage, "bob");

    try {
      await register(alicePage, alice, password);
      await register(bobPage, bob, password);

      await login(alicePage, alice, password);
      await login(bobPage, bob, password);

      await ensureUnlocked(alicePage, password);
      await ensureUnlocked(bobPage, password);

      await openChatWith(alicePage, bob);
      await openChatWith(bobPage, alice);

      const runId = `${Date.now()}`;
      for (let i = 0; i < 10; i++) {
        const aText = `e2e-${runId}-a-${i}`;
        await sendMessage(alicePage, aText);
        await expectEventuallyVisibleInChat({ page: bobPage, peerUsername: alice, password, text: aText });

        const bText = `e2e-${runId}-b-${i}`;
        await sendMessage(bobPage, bText);
        await expectEventuallyVisibleInChat({ page: alicePage, peerUsername: bob, password, text: bText });
      }
    } finally {
      await aliceCtx.close().catch(() => {});
      await bobCtx.close().catch(() => {});
    }
  });

  test("reload keeps messages visible (ELD persistence + unlock gate)", async ({ browser }) => {
    const password = "Testpass1!";
    const alice = uniqueUser("alice");
    const bob = uniqueUser("bob");

    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const bobPage = await bobCtx.newPage();
    attachPageDebug(alicePage, "alice");
    attachPageDebug(bobPage, "bob");

    try {
      await register(alicePage, alice, password);
      await register(bobPage, bob, password);

      await login(alicePage, alice, password);
      await login(bobPage, bob, password);

      await ensureUnlocked(alicePage, password);
      await ensureUnlocked(bobPage, password);

      await openChatWith(alicePage, bob);
      await openChatWith(bobPage, alice);

      const text = `e2e-persist-${Date.now()}`;
      await sendMessage(alicePage, text);
      await expectEventuallyVisibleInChat({ page: bobPage, peerUsername: alice, password, text });

      await alicePage.reload();
      await bobPage.reload();

      await ensureUnlocked(alicePage, password);
      await ensureUnlocked(bobPage, password);

      // Need to re-open chat after reload.
      await openChatWith(alicePage, bob);
      await openChatWith(bobPage, alice);

      await expect(alicePage.getByText(text)).toBeVisible({ timeout: 60_000 });
      await expect(bobPage.getByText(text)).toBeVisible({ timeout: 60_000 });

      // Send another message after reload to ensure ratchet state still functional.
      const text2 = `e2e-after-reload-${Date.now()}`;
      await sendMessage(bobPage, text2);
      await expectEventuallyVisibleInChat({ page: alicePage, peerUsername: bob, password, text: text2 });
    } finally {
      await aliceCtx.close().catch(() => {});
      await bobCtx.close().catch(() => {});
    }
  });
});
