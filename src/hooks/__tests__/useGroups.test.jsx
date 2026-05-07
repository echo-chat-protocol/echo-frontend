// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useGroups } from "../useGroups";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("useGroups hook", () => {
  afterEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("loads from localStorage and persists changes", async () => {
    const userId = "U1";
    const storageKey = `groups-${userId}`;
    localStorage.setItem(storageKey, JSON.stringify([{ groupId: "G1", name: "Group 1" }]));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let api = null;

    const Harness = () => {
      const hook = useGroups(userId);
      useEffect(() => {
        api = hook;
      }, [hook]);
      return null;
    };

    await act(async () => {
      root.render(<Harness />);
      await flush();
    });

    expect(api).not.toBeNull();
    expect(api.groups).toEqual([{ groupId: "G1", name: "Group 1" }]);

    await act(async () => {
      api.upsertGroup({ groupId: "G2", name: "Group 2" });
      await flush();
    });

    const saved = JSON.parse(localStorage.getItem(storageKey));
    expect(saved.some((g) => g.groupId === "G2")).toBe(true);

    await act(async () => {
      api.removeGroup("G1");
      await flush();
    });

    const saved2 = JSON.parse(localStorage.getItem(storageKey));
    expect(saved2.some((g) => g.groupId === "G1")).toBe(false);
  });

  it("setAllGroups normalizes duplicates and coerces groupId", async () => {
    const userId = "U2";
    const storageKey = `groups-${userId}`;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let api = null;
    const Harness = () => {
      const hook = useGroups(userId);
      useEffect(() => {
        api = hook;
      }, [hook]);
      return null;
    };

    await act(async () => {
      root.render(<Harness />);
      await flush();
    });

    await act(async () => {
      api.setAllGroups([
        { groupId: 123, name: "A" },
        { groupId: "123", name: "A-dup" },
        { id: "G3", name: "B" },
        null,
      ]);
      await flush();
    });

    expect(api.groups.length).toBe(2);
    expect(api.groups[0].groupId).toBe("123");
    expect(api.groups[1].groupId).toBe("G3");

    const saved = JSON.parse(localStorage.getItem(storageKey));
    expect(saved.length).toBe(2);
  });
});
