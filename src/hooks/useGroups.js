import { useState, useEffect, useRef } from 'react';

export const useGroups = (userId) => {
  const [groups, setGroups] = useState([]);
  const isInitialized = useRef(false); // prevents overwrite on re-renders

  // Load only once when userId becomes available
  useEffect(() => {
    if (!userId || isInitialized.current) return;

    const saved = localStorage.getItem(`groups-${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setGroups(parsed);
      } catch (e) {
        console.error("Failed to parse localStorage groups", e);
      }
    }

    isInitialized.current = true;
  }, [userId]);

  // Save to localStorage **only after initial load**
  useEffect(() => {
    if (!userId || !isInitialized.current) return;
    localStorage.setItem(`groups-${userId}`, JSON.stringify(groups));
  }, [groups, userId]);

  const setAllGroups = (serverGroups) => {
    if (!Array.isArray(serverGroups)) return;
    setGroups((prev) => {
      const previousById = new Map(
        prev.map((group) => [String(group?.groupId ?? group?.id ?? ""), group]),
      );
      const normalized = [];
      const seen = new Set();

      for (const g of serverGroups) {
        const groupId = String(g?.groupId ?? g?.id ?? '');
        if (!groupId || seen.has(groupId)) continue;
        seen.add(groupId);

        const existing = previousById.get(groupId);
        normalized.push({
          ...existing,
          ...g,
          groupId,
          lastActivityText: g?.lastActivityText ?? existing?.lastActivityText ?? "",
          lastActivityAt: g?.lastActivityAt ?? existing?.lastActivityAt ?? g?.createdAt ?? existing?.createdAt,
        });
      }

      return normalized;
    });
  };

  // Upsert group by groupId; optionally move to top when activity is provided.
  const upsertGroup = (groupData, activity = null) => {
    const groupId = String(groupData?.groupId ?? groupData?.id ?? '');
    if (!groupId) return;

    setGroups((prev) => {
      const existingIndex = prev.findIndex((g) => String(g?.groupId ?? g?.id ?? '') === groupId);
      const updated = [...prev];

      if (existingIndex >= 0) {
        const merged = {
          ...updated[existingIndex],
          ...groupData,
          groupId,
        };

        // Optional: track last activity for ordering (message/notification timestamps).
        if (activity?.timestamp) merged.lastActivityAt = activity.timestamp;
        if (activity?.text != null) merged.lastActivityText = activity.text;

        updated[existingIndex] = merged;

        if (activity) {
          const [moved] = updated.splice(existingIndex, 1);
          updated.unshift(moved);
        }
      } else {
        updated.unshift({
          ...groupData,
          groupId,
          lastActivityAt: activity?.timestamp || new Date().toISOString(),
          lastActivityText: activity?.text ?? "",
        });
      }

      return updated.slice(0, 50); // Keep recent 50 groups
    });
  };

  const removeGroup = (groupId) => {
    const gid = String(groupId ?? '');
    if (!gid) return;
    setGroups((prev) => prev.filter((g) => String(g?.groupId ?? g?.id ?? '') !== gid));
  };

  return { groups, setAllGroups, upsertGroup, removeGroup };
};
