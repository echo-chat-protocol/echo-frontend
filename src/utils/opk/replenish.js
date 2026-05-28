export function createOpkReplenishHandler({
  socket,
  eld,
  generateOneTimePreKeys,
  maxBatch = 200,
} = {}) {
  if (!socket || typeof socket.emit !== "function") {
    throw new Error("createOpkReplenishHandler requires a socket with emit()");
  }
  if (!eld) {
    throw new Error("createOpkReplenishHandler requires eld");
  }
  if (typeof generateOneTimePreKeys !== "function") {
    throw new Error("createOpkReplenishHandler requires generateOneTimePreKeys()");
  }

  let inFlight = false;

  return async ({ needed } = {}) => {
    const count = Math.min(Math.max(Number(needed) || 0, 0), maxBatch);
    if (count <= 0) return;
    if (inFlight) return;

    if (!eld.isUnlocked || !eld.isUnlocked()) {
      return;
    }

    inFlight = true;
    try {
      const { privateKeys, publicBundle } = await generateOneTimePreKeys(count);
      await eld.storeOPKs(privateKeys);

      await new Promise((resolve, reject) => {
        socket.emit(
          "uploadOneTimePreKeys",
          { oneTimePreKeys: publicBundle },
          (response) => {
            if (response?.success) resolve(response);
            else reject(new Error(response?.error || "Failed to upload OPKs"));
          }
        );
      });
    } finally {
      inFlight = false;
    }
  };
}

export function requestOpkStatusAndReplenish({ socket, handler } = {}) {
  if (!socket || typeof socket.emit !== "function") {
    throw new Error("requestOpkStatusAndReplenish requires a socket with emit()");
  }
  if (typeof handler !== "function") {
    throw new Error("requestOpkStatusAndReplenish requires handler()");
  }

  return new Promise((resolve) => {
    socket.emit("getOpkStatus", {}, (status) => {
      if (status?.success && status.needed > 0) {
        handler({ needed: status.needed });
      }
      resolve(status);
    });
  });
}

