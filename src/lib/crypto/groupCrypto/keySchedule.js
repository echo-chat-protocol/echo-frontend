import init, * as protocol from '@mascaro101/echo-protocol';

// SHA-256 output (Nh), AES-256 key length (Nk) and AES-256 nonce length (Nn)
const NH = 32;
const NK = 32;
const NN = 12;

const TEXT_ENCODER = new TextEncoder();
const HKDF_EXTRACT_EXPORT = 'hkdf_extract';
const HKDF_EXPAND_EXPORT = 'hkdf_expand';

async function hkdfExtract(salt, ikm) {
    const extract = protocol[HKDF_EXTRACT_EXPORT];
    if (typeof extract === 'function') {
        return extract(salt, ikm);
    }
    console.warn('[HKDF] extract fallback', {
        expected: HKDF_EXTRACT_EXPORT,
        actualType: typeof extract,
        isUndefined: extract === undefined,
        protocolKeys: Object.keys(protocol).slice(0, 20),
    });
    return;
}

async function hkdfExpand(prk, info, length) {
    const expand = protocol[HKDF_EXPAND_EXPORT];
    if (typeof expand === 'function') {
        return expand(prk, info, length);
    }
    console.warn('[HKDF] expand fallback', {
        expected: HKDF_EXPAND_EXPORT,
        actualType: typeof expand,
        isUndefined: expand === undefined,
        protocolKeys: Object.keys(protocol).slice(0, 20),
    });
    return;
}

// This function constructs an HKDF label that is fed later to the HKDF-Expand
// Raw bytes are not fed into the HKDF Expand, a structured label is used instead,
// this is to keep keys domain-seperated and deterministic (mirar HKDF.js)
function encodeHKDFLabel(length, label, context) {
    const labelBytes = TEXT_ENCODER.encode('MLS 1.0 ' + label);
    const buf = new Uint8Array(2 + 1 + labelBytes.length + 4 + context.length);
    let o = 0;
    buf[o++] = (length >>> 8) & 0xff;
    buf[o++] = length & 0xff;
    buf[o++] = labelBytes.length;
    buf.set(labelBytes, o); o += labelBytes.length;
    const cl = context.length;
    buf[o++] = (cl >>> 24) & 0xff;
    buf[o++] = (cl >>> 16) & 0xff;
    buf[o++] = (cl >>> 8) & 0xff;
    buf[o++] = cl & 0xff;
    buf.set(context, o);
    return buf;
}

// Exported functions that expand and extract using the label constructed above
export async function expandWithLabel(secret, label, context, length) {
    await init();
    const info = encodeHKDFLabel(length, label, context);
    return hkdfExpand(secret, info, length);
}

export async function deriveSecret(secret, label) {
    return expandWithLabel(secret, label, new Uint8Array(0), NH);
}

// Encodes the groupId and epoch into context to be fed into HKDF
function encodeGroupContext(groupId, epoch) {
    const gid = TEXT_ENCODER.encode(groupId);
    const buf = new Uint8Array(4 + 2 + gid.length);
    buf[0] = (epoch >>> 24) & 0xff;
    buf[1] = (epoch >>> 16) & 0xff;
    buf[2] = (epoch >>> 8) & 0xff;
    buf[3] = epoch & 0xff;
    buf[4] = (gid.length >>> 8) & 0xff;
    buf[5] = gid.length & 0xff;
    buf.set(gid, 6);
    return buf;
}

export async function advanceEpoch({ initSecret, commitSecret, groupId, epoch }) {
    await init();

    // The secret the added user derives when joining a group
    const joinerSecret = await hkdfExtract(initSecret, commitSecret);

    // computing the master secret for the new epoch, the epoch advanced with the joiner secret
    const epochSecret = await expandWithLabel(
        joinerSecret, 'epoch', encodeGroupContext(groupId, epoch), NH
    );

    // applicationSecret is used to derive encryption keys
    // senderDataSecret for sender data 
    // nextInitSecret is the init secret for the next epoch
    const [applicationSecret, senderDataSecret, nextInitSecret] = await Promise.all([
        deriveSecret(epochSecret, 'encryption'),
        deriveSecret(epochSecret, 'sender_data'),
        deriveSecret(epochSecret, 'init'),
    ]);

    return { epochSecret, nextInitSecret, applicationSecret, senderDataSecret };
}

// this encodes the leaf index and generation into a context then fed into the HDKF-expand
// this means that the derived key is unique per sender and per message generation
function encodeAppSecretContext(leafIndex, generation) {
    const buf = new Uint8Array(8);
    buf[0] = (leafIndex >>> 24) & 0xff;
    buf[1] = (leafIndex >>> 16) & 0xff;
    buf[2] = (leafIndex >>> 8) & 0xff;
    buf[3] = leafIndex & 0xff;
    buf[4] = (generation >>> 24) & 0xff;
    buf[5] = (generation >>> 16) & 0xff;
    buf[6] = (generation >>> 8) & 0xff;
    buf[7] = generation & 0xff;
    return buf;
}
// derives the nonce and key used to encrypt the message payload
export async function deriveAppKeyAndNonce(applicationSecret, senderLeafIndex, generation) {
    const ctx = encodeAppSecretContext(senderLeafIndex, generation);
    const [key, nonce] = await Promise.all([
        // 32 bytes for the key and 12 for the nonce
        expandWithLabel(applicationSecret, 'key', ctx, NK),
        expandWithLabel(applicationSecret, 'nonce', ctx, NN),
    ]);
    return { key, nonce };
}

// ratchets the application secret to derive the next generation appSecret
export async function ratchetAppSecret(applicationSecret, senderLeafIndex, generation) {
    const ctx = encodeAppSecretContext(senderLeafIndex, generation);
    return expandWithLabel(applicationSecret, 'secret', ctx, NH);
}
