/**
 * UI / replay helpers for persisted MLS commit artifacts.
 */

function rosterUserIdForLeaf(roster, leafIndex) {
  if (!Number.isInteger(leafIndex) || !Array.isArray(roster)) return null
  const entry = roster.find((member) => member?.leafIndex === leafIndex)
  return entry?.userId ?? null
}

/** Hide "Alice added Alice" rows for per-device leaf provisioning. */
export function shouldShowCommitSystemMessage({ commit, priorState }) {
  if (!commit || typeof commit !== 'object') return false
  if (commit.type !== 'add') return true

  const actorUserId =
    rosterUserIdForLeaf(priorState?.roster, commit.senderLeafIndex) ??
    rosterUserIdForLeaf(commit?.roster, commit.senderLeafIndex)

  if (
    actorUserId &&
    commit.targetUserId != null &&
    String(commit.targetUserId) === String(actorUserId)
  ) {
    return false
  }

  return true
}

/** Only surface a commit system row when replay is about to apply that epoch. */
export function shouldReplayCommitSystemMessage(replayState, commit) {
  if (!shouldShowCommitSystemMessage({ commit, priorState: replayState })) return false
  if (!Number.isInteger(replayState?.epoch) || !Number.isInteger(commit?.epoch)) return false
  return commit.epoch === replayState.epoch + 1
}
