import init_dh, {
    generate_private_ephemeral_key,
    generate_public_ephemeral_key,
} from '@mascaro101/echo-protocol';

import { arrayBufferToBase64 } from '../helpers';

const OPK_BATCH_SIZE = 100;

export const generateOneTimePreKeys = async (count = OPK_BATCH_SIZE) => {
    await init_dh();

    const privateKeys = [];
    const publicBundle = [];

    for (let i = 0; i < count; i++) {
        const opkId = crypto.randomUUID();
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const privateKey = generate_private_ephemeral_key(randomBytes);
        const publicKey = generate_public_ephemeral_key(privateKey);

        privateKeys.push({ opkId, privateKey });
        publicBundle.push({ opkId, publicKey: arrayBufferToBase64(publicKey) });
    }

    return { privateKeys, publicBundle };
};
