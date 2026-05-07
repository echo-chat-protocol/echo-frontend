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

test("two users can chat", async ({ browser }) => {
  test.setTimeout(180_000);

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

    const text = `hello-${Date.now()}`;
    await sendMessage(alicePage, text);

    // Bob should receive and display the decrypted message.
    await expectEventuallyVisibleInChat({ page: bobPage, peerUsername: alice, password, text });
  } finally {
    await aliceCtx.close().catch(() => {});
    await bobCtx.close().catch(() => {});
  }
});
