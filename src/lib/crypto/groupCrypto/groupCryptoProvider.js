import {
  createNewGroupState,
  loadGroupState,
  saveGroupState,
} from './groupStateStorage.js';
import {
  decryptApplicationMessage,
  encryptApplicationMessage,
} from './messageFlow.js';
import {
  applyCommit,
  buildAddCommit,
  buildRemoveCommit,
} from './commitFlow.js';
import {
  buildInitialWelcomes,
  processWelcome,
} from './welcomeFlow.js';

export {
  saveGroupState,
  loadGroupState,
  createNewGroupState,
  encryptApplicationMessage,
  decryptApplicationMessage,
  applyCommit,
  processWelcome,
  buildAddCommit,
  buildRemoveCommit,
  buildInitialWelcomes,
};

const groupCryptoProvider = {
  saveGroupState,
  loadGroupState,
  createNewGroupState,
  encryptApplicationMessage,
  decryptApplicationMessage,
  applyCommit,
  processWelcome,
  buildAddCommit,
  buildRemoveCommit,
  buildInitialWelcomes,
};

export default groupCryptoProvider;
