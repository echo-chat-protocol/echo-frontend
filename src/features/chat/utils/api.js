const fetchPublicIdentityKeyX25519 = async (socket, targetUserId) => {
    return new Promise((resolve, reject) => {
        socket.emit('getPublicIdentityKeyX25519', { targetUserId }, (response) => {
            if (response.success) {
                resolve(response.publicIdentityKeyX25519);
            } else {
                console.error('❌ Failed to fetch publicIdentityKey:', response.error);
                reject(new Error(response.error));
            }
        });
    });
};

const fetchSignedPreKey = async (socket, targetUserId) => {
    return new Promise((resolve, reject) => {
        socket.emit('getSignedPreKey', { targetUserId }, (response) => {
            if (response.success) {
                resolve({ signedPreKey: response.signedPreKey, signature: response.signature, spkId: response.spkId ?? null });
            } else {
                console.error('❌ Failed to fetch getSignedPreKey:', response.error);
                reject(new Error(response.error));
            }
        });
    });
};

const fetchPreKeyBundle = async (socket, targetUserId) => {
    return new Promise((resolve, reject) => {
        socket.emit('getPreKeyBundle', { targetUserId }, (response) => {
            if (response.success && response.bundle) {
                resolve(response.bundle);
            } else {
                reject(new Error(response.error || 'Failed to fetch PreKeyBundle'));
            }
        });
    });
};

const fetchPublicIdentityKeyEd25519 = async (socket, targetUserId) => {
    return new Promise((resolve, reject) => {
        socket.emit('getPublicIdentityKeyEd25519', { targetUserId }, (response) => {
            if (response.success) {
                resolve(response.publicIdentityKeyEd25519);
            } else {
                console.error('❌ Failed to fetch publicIdentityKey:', response.error);
                reject(new Error(response.error));
            }
        });
    });
};

const fetchLatestMessageNumber = async (socket, targetUserId) => {
    return new Promise((resolve) => {
        socket.emit('getLatestMessageNumber', { targetUserId }, (response) => {
            // Always resolve with a number; -1 means "no messages yet" (so next is 0).
            resolve(response?.success ? response.messageNumber : -1);
        });
    });
};

const checkFirstMessage = async (socket, targetUserId) => {
    return new Promise((resolve) => {
      socket.emit('checkIfMessagesExist', { targetUserId }, (response) => {
        if (response.success) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  };

export { fetchPublicIdentityKeyX25519,
         fetchSignedPreKey,
         fetchPreKeyBundle,
         fetchPublicIdentityKeyEd25519,
         fetchLatestMessageNumber,
         checkFirstMessage };
