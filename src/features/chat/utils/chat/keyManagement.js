import eld from '../../../../../utils/storage/EncryptedLocalDatabase';

// In-memory caches
const ephemeralCache = new Map();

const sendingChainKeyCache = new Map();
const receivingChainKeyCache = new Map();
const rootKeyCache = new Map();
const sessionKeyCache = new Map();
const pendingGroupPlaintextCache = new Map();
const PENDING_GROUP_PLAINTEXT_TTL_MS = 5 * 60 * 1000;

const prunePendingGroupPlaintexts = () => {
  const now = Date.now();
  for (const [cacheKey, entry] of pendingGroupPlaintextCache.entries()) {
    if (!entry || (now - entry.createdAt) > PENDING_GROUP_PLAINTEXT_TTL_MS) {
      pendingGroupPlaintextCache.delete(cacheKey);
    }
  }
};

const getPendingGroupPlaintextKey = ({ groupId, headerB64, ciphertextB64 }) => {
  if (
    typeof groupId !== 'string' || groupId.length === 0 ||
    typeof headerB64 !== 'string' || headerB64.length === 0 ||
    typeof ciphertextB64 !== 'string' || ciphertextB64.length === 0
  ) {
    return null;
  }

  return `${groupId}:${headerB64}:${ciphertextB64}`;
};

export const setPendingOutgoingGroupMessage = ({ groupId, headerB64, ciphertextB64, text }) => {
  prunePendingGroupPlaintexts();
  const cacheKey = getPendingGroupPlaintextKey({ groupId, headerB64, ciphertextB64 });
  if (!cacheKey || typeof text !== 'string') return;

  pendingGroupPlaintextCache.set(cacheKey, {
    text,
    createdAt: Date.now(),
  });
};

export const consumePendingOutgoingGroupMessage = ({ groupId, headerB64, ciphertextB64 }) => {
  prunePendingGroupPlaintexts();
  const cacheKey = getPendingGroupPlaintextKey({ groupId, headerB64, ciphertextB64 });
  if (!cacheKey) return null;

  const entry = pendingGroupPlaintextCache.get(cacheKey);
  pendingGroupPlaintextCache.delete(cacheKey);
  return typeof entry?.text === 'string' ? entry.text : null;
};

export const deletePendingOutgoingGroupMessage = ({ groupId, headerB64, ciphertextB64 }) => {
  const cacheKey = getPendingGroupPlaintextKey({ groupId, headerB64, ciphertextB64 });
  if (!cacheKey) return;
  pendingGroupPlaintextCache.delete(cacheKey);
};

export const setOwnEphemeralKeys = async (userId, targetUserId, publicKey, privateKey) => {
  if (!publicKey || !privateKey) {
    throw new Error('Invalid keys: must provide both public and private');
  }

  const existingData = await getEphemeralData(userId, targetUserId) || {};

  await setEphemeralData(userId, targetUserId, {
    ...existingData,
    ephPub: publicKey,
    ephPriv: privateKey
  });
}

export const getOwnEphemeralKeys = async (userId, targetUserId) => {
  const data = await getEphemeralData(userId, targetUserId);

  if (data?.ephPriv && data?.ephPub) {
    return {
      private: data.ephPriv,
      public: data.ephPub
    };
  }

  return null;
}

// Message Numbers  

export const getCurrentSendingNumber = async (targetUserId) => {
  const data = await eld.getCurrentNs(targetUserId);
  return data;
}

export const setCurrentSendingNumber = async (targetUserId, number) => {
  await eld.storeCurrentSendingNumber(targetUserId, number);
}

export const getCurrentReceivingNumber = async (targetUserId) => {
  const data = await eld.getCurrentNr(targetUserId);
  return data;
}

export const setCurrentReceivingNumber = async (targetUserId, number) => {
  await eld.storeCurrentReceivingNumber(targetUserId, number);
}

export const getPreviousSendingNumber = async (targetUserId) => {
  const data = await eld.getPn(targetUserId);
  return data;
}

export const setPreviousSendingNumber = async (targetUserId, number) => {
  await eld.storePreviousSendingNumber(targetUserId, number);
}

export const setSkippedMessages = async (targetUserId, skippedKeys) => {
  await eld.storeSkippedMessageKeys(targetUserId, skippedKeys);
}

export const getSkippedMessages = async (targetUserId) => {
  const data = await eld.getSkippedMessageKeys(targetUserId);
  return data;
}

export const deleteOwnEphemeralKeys = async (userId, targetUserId) => {
  const existingData = await getEphemeralData(userId, targetUserId);

  if (existingData) {
    // Remove only the ephemeral key fields, keep other data
    delete existingData.ephPriv;
    delete existingData.ephPub;
    await setEphemeralData(userId, targetUserId, existingData);
  }
}

// SESSION KEYS (temporary in-memory storage for message keys, used for echo decryption)
export const setSessionKey = (userId, targetUserId, messageKey) => {
  const sessionId = `${userId}->${targetUserId}`;
  sessionKeyCache.set(sessionId, messageKey);
};

export const getSessionKey = (userId, targetUserId) => {
  const sessionId = `${userId}->${targetUserId}`;
  const key = sessionKeyCache.get(sessionId);
  return key || null;
};

// ROOT KEYS 

// Get Root key for given session  
export const getRootKey = async (userId, targetUserId) => {
  const rootKeyId = [userId, targetUserId].sort().join('-');

  if (rootKeyCache.has(rootKeyId)) {
    return rootKeyCache.get(rootKeyId);
  }

  if (eld.isUnlocked()) {
    try {
      const data = await eld.getRootKey(targetUserId);
      if (data?.rootKey) {
        rootKeyCache.set(rootKeyId, data.rootKey);
        return data.rootKey;
      }
    } catch (err) {
      console.error('[KeyMgmt] Failed to get root key:', err);
    }
  }
  return null;
}

// Set Root Key for given session
export const setRootKey = async (userId, targetUserId, rootKey) => {
  const rootKeyId = [userId, targetUserId].sort().join('-');

  let normalizedKey = rootKey;
  if (!(normalizedKey instanceof Uint8Array)) {
    if (normalizedKey instanceof ArrayBuffer) {
      normalizedKey = new Uint8Array(normalizedKey);
    } else if (Array.isArray(normalizedKey)) {
      normalizedKey = new Uint8Array(normalizedKey);
    }
  }

  if (!(normalizedKey instanceof Uint8Array) || normalizedKey.length !== 32) {
    console.error('[KeyMgmt] Refusing to store invalid root key');
    return;
  }

  rootKeyCache.set(rootKeyId, normalizedKey);

  if (eld.isUnlocked()) {
    try {
      await eld.storeRootKey(targetUserId, normalizedKey);
    } catch (err) {
      console.error('[KeyMgmt] Failed to store root key:', err);
    }
  }
}

// SENDING CHAIN KEYS
export const setSendingChainKey = async (userId, targetUserId, chainKey) => {
  const sendingId = `${userId}->${targetUserId}`;
  let normalizedKey = chainKey instanceof Uint8Array ? chainKey : new Uint8Array(chainKey);

  sendingChainKeyCache.set(sendingId, normalizedKey);

  if (eld.isUnlocked()) {
    await eld.storeSendingChainKey(targetUserId, normalizedKey);
  }
};

export const getSendingChainKey = async (userId, targetUserId) => {
  const sendingId = `${userId}->${targetUserId}`;

  if (sendingChainKeyCache.has(sendingId)) {
    return sendingChainKeyCache.get(sendingId);
  }

  if (eld.isUnlocked()) {
    const data = await eld.getSendingChainKey(targetUserId);
    if (data?.sendingChainKey) {
      sendingChainKeyCache.set(sendingId, data.sendingChainKey);
      return data.sendingChainKey;
    }
  }

  return null;
};

// RECEIVING CHAIN KEYS
export const setReceivingChainKey = async (userId, targetUserId, chainKey) => {
  const receivingId = `${targetUserId}->${userId}`;
  let normalizedKey = chainKey instanceof Uint8Array ? chainKey : new Uint8Array(chainKey);

  receivingChainKeyCache.set(receivingId, normalizedKey);

  if (eld.isUnlocked()) {
    await eld.storeReceivingChainKey(targetUserId, normalizedKey);
  }
};

export const getReceivingChainKey = async (userId, targetUserId) => {
  const receivingId = `${targetUserId}->${userId}`;

  if (receivingChainKeyCache.has(receivingId)) {
    return receivingChainKeyCache.get(receivingId);
  }

  if (eld.isUnlocked()) {
    const data = await eld.getReceivingChainKey(targetUserId);
    if (data?.receivingChainKey) {
      receivingChainKeyCache.set(receivingId, data.receivingChainKey);
      return data.receivingChainKey;
    }
  }

  return null;
};

// PEER IDENTITY KEYS

export const storePeerIdentityKeys = async (peerId, keys) => {
  if (!peerId) throw new Error("storePeerIdentityKeys requires peerId");

  if (!eld.isUnlocked()) {
    console.error("[KeyMgmt] Database locked - cannot store peer identity keys");
    return;
  }

  try {
    await eld.storePeerIdentityKey(peerId, keys);
  } catch (err) {
    console.error("[KeyMgmt] Failed to store peer IK data:", err);
  }
};

export const getPeerIdentityKeys = async (peerId) => {
  if (!eld.isUnlocked()) {
    console.error('[KeyMgmt] Database locked - cannot get peer identity keys');
    return null;
  }
  return await eld.getPeerIdentityKey(peerId);
};

export const resetConversationState = async (userId, targetUserId) => {
  if (!userId || !targetUserId) {
    throw new Error("resetConversationState requires userId and targetUserId");
  }
  if (!eld.isUnlocked()) {
    console.error("[KeyMgmt] Database locked - cannot reset conversation state");
    return;
  }

  const rootKeyId = [userId, targetUserId].sort().join('-');
  const sessionId = [userId, targetUserId].sort().join('-');
  const sendingId = `${userId}->${targetUserId}`;
  const receivingId = `${targetUserId}->${userId}`;
  const sessionKeyId = `${userId}->${targetUserId}`;

  rootKeyCache.delete(rootKeyId);
  ephemeralCache.delete(sessionId);
  sendingChainKeyCache.delete(sendingId);
  receivingChainKeyCache.delete(receivingId);
  sessionKeyCache.delete(sessionKeyId);

  try {
    await eld.deleteRootKey(targetUserId);
    await eld.deleteSendingChainKey(targetUserId);
    await eld.deleteReceivingChainKey(targetUserId);
    await eld.deleteEphemeralData(targetUserId);
    await eld.deleteCurrentSendingNumber(targetUserId);
    await eld.deleteCurrentReceivingNumber(targetUserId);
    await eld.deletePreviousSendingNumber(targetUserId);
    await eld.deleteSkippedMessageKeys(targetUserId);
  } catch (err) {
    console.error("[KeyMgmt] Failed to reset conversation state:", err);
  }
};

// IDENTITY KEYS

export const getIdentityKeys = async () => {
  if (!eld.isUnlocked()) {
    console.error('[KeyMgmt] Database locked - cannot get identity keys');
    return null;
  }
  return await eld.getIdentityKeys();
};

// OPK (One-Time PreKeys)

export const getOPKPrivateKey = async (opkId) => {
  if (!opkId) return null;
  if (!eld.isUnlocked()) {
    console.error('[KeyMgmt] Database locked - cannot get OPK');
    return null;
  }
  return await eld.getOPK(opkId);
};

export const deleteOPKPrivateKey = async (opkId) => {
  if (!opkId) return;
  if (!eld.isUnlocked()) return;
  try {
    await eld.deleteOPK(opkId);
  } catch (err) {
    console.error('[KeyMgmt] Failed to delete OPK:', err);
  }
};

// EPHEMERAL KEYS 

export const setEphemeralData = async (userId, targetUserId, data) => {
  const sessionId = [userId, targetUserId].sort().join('-');
  ephemeralCache.set(sessionId, data);

  if (eld.isUnlocked()) {
    try {
      await eld.storeEphemeralData(targetUserId, data);
    } catch (err) {
      console.error('[KeyMgmt] Failed to store ephemeral data:', err);
    }
  }
};

export const getEphemeralData = async (userId, targetUserId) => {
  const sessionId = [userId, targetUserId].sort().join('-');

  if (ephemeralCache.has(sessionId)) {
    return ephemeralCache.get(sessionId);
  }

  if (eld.isUnlocked()) {
    try {
      const data = await eld.getEphemeralData(targetUserId);
      if (data) {
        ephemeralCache.set(sessionId, data);
        return data;
      }
    } catch (err) {
      console.error('[KeyMgmt] Failed to get ephemeral data:', err);
    }
  }

  return null;
};

// MESSAGES 

export const updateSavedMessages = async (userId, targetUserId, message, setMessages) => {
  if (eld.isUnlocked()) {
    try {
      await eld.storeMessage(targetUserId, message);
    } catch (err) {
      console.error('[KeyMgmt] Failed to store message:', err);
    }
  }

  if (setMessages) {
    setMessages(prev => {
      if (prev.some(msg => msg._id === message._id)) return prev;
      return [...prev, message];
    });
  }

  window.dispatchEvent(new CustomEvent('localStorageUpdated', {
    detail: {
      userId,
      targetUserId,
      message,
      latestMessage: message.text,
      timestamp: message.timestamp || message.createdAt
    }
  }));
};

export const getSavedMessages = async (userId, targetUserId) => {
  if (!eld.isUnlocked()) {
    console.warn('[KeyMgmt] Database locked - cannot get messages');
    return [];
  }

  try {
    return await eld.getMessages(targetUserId);
  } catch (err) {
    console.error('[KeyMgmt] Failed to get messages:', err);
    return [];
  }
};

export const updateMessageSeenStatus = async (userId, targetUserId) => {
  if (!eld.isUnlocked()) return;

  try {
    const messages = await eld.getMessages(targetUserId);
    for (const msg of messages) {
      if (msg.userId === userId && !msg.seenStatus) {
        msg.seenStatus = true;
        await eld.storeMessage(targetUserId, msg);
      }
    }
  } catch (err) {
    console.error('[KeyMgmt] Failed to update seen status:', err);
  }
};
