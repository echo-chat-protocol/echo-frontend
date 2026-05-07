import {
  decryptApplicationMessage,
  loadGroupState,
  saveGroupState,
} from "../crypto/groupCryptoProvider";
import {
  consumePendingOutgoingGroupMessage,
  updateSavedMessages,
} from "./keyManagement";

const TEXT_DECODER = new TextDecoder();
const GROUP_CACHE_PREFIX = "group:";

const getGroupCacheId = (groupId) => `${GROUP_CACHE_PREFIX}${groupId}`;

export async function decryptIncomingGroupMessage({
  message,
  userId,
  username = null,
  currentState = null,
  setMessages = null,
}) {
  const groupId = String(message?.groupId ?? "");
  if (!groupId) {
    throw new Error("decryptIncomingGroupMessage requires a groupId");
  }

  const createdAt = message?.createdAt || message?.timestamp || new Date().toISOString();
  const isOwnMessage = String(message?.userId ?? "") === String(userId ?? "");
  const fromUsername =
    message?.username || (isOwnMessage ? username : "Member");

  let text =
    typeof message?.payload === "string"
      ? message.payload
      : typeof message?.text === "string"
        ? message.text
        : "";
  let nextState = currentState;

  if (
    message?.contentType === "application" &&
    message?.headerB64 &&
    message?.ciphertextB64
  ) {
    const pendingPlaintext = isOwnMessage
      ? consumePendingOutgoingGroupMessage({
        groupId,
        headerB64: message.headerB64,
        ciphertextB64: message.ciphertextB64,
      })
      : null;

    if (typeof pendingPlaintext === "string") {
      text = pendingPlaintext;
    } else {
      const localState = currentState ?? await loadGroupState(groupId);
      if (!localState) {
        throw new Error(`Missing local MLS state for group ${groupId}`);
      }

      const decrypted = await decryptApplicationMessage({
        state: localState,
        header: message.headerB64,
        ciphertext: message.ciphertextB64,
        includeNewState: true,
      });
      const plaintextBytes = decrypted?.plaintextBytes ?? decrypted;
      nextState = decrypted?.newState ?? localState;
      text = TEXT_DECODER.decode(plaintextBytes);

      if (nextState && nextState !== localState) {
        nextState = await saveGroupState(groupId, nextState);
      }
    }
  }

  const formattedMessage = {
    _id: message?._id || `${groupId}:${String(message?.seq ?? createdAt)}`,
    userId: String(message?.userId ?? ""),
    username: fromUsername,
    text,
    createdAt,
    seenStatus: true,
  };

  await updateSavedMessages(
    userId,
    getGroupCacheId(groupId),
    formattedMessage,
    setMessages,
  );

  return {
    formattedMessage,
    nextState,
  };
}

export default decryptIncomingGroupMessage;
