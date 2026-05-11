import { createNewGroupState, loadGroupState, saveGroupState } from './groupStateStorage.js'
import { decryptApplicationMessage, encryptApplicationMessage } from './messageFlow.js'
import {
  applyCommit,
  buildAddCommit,
  buildRemoveCommit,
  buildUpdateCommit,
  buildReInitCommit,
} from './commitFlow.js'
import { buildInitialWelcomes, processWelcome } from './welcomeFlow.js'
import {
  createProposal,
  verifyProposal,
  receiveProposal,
  createUpdateProposal,
  createExternalInitProposal,
  createPskProposal,
  createReInitProposal,
} from './proposals.js'

// Re-export the group crypto surface from one entry point.
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
  buildUpdateCommit,
  buildReInitCommit,
  buildInitialWelcomes,
  createProposal,
  verifyProposal,
  receiveProposal,
  createUpdateProposal,
  createExternalInitProposal,
  createPskProposal,
  createReInitProposal,
}

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
  buildUpdateCommit,
  buildReInitCommit,
  buildInitialWelcomes,
  createProposal,
  verifyProposal,
  receiveProposal,
  createUpdateProposal,
  createExternalInitProposal,
  createPskProposal,
  createReInitProposal,
}

export default groupCryptoProvider
