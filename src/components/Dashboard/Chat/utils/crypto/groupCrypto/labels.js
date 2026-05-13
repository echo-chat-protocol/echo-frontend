// Key Schedule (HKDF-Expand via encodeHKDFLabel)
export const LABEL_EPOCH = 'Echo/v1/epoch'
export const LABEL_ENCRYPTION = 'Echo/v1/encryption'
export const LABEL_SENDER_DATA = 'Echo/v1/sender-data'
export const LABEL_EXTERNAL = 'Echo/v1/external'
export const LABEL_MEMBERSHIP = 'Echo/v1/membership'
export const LABEL_RESUMPTION = 'Echo/v1/resumption'
export const LABEL_INIT = 'Echo/v1/init'
export const LABEL_WELCOME = 'Echo/v1/welcome'
export const LABEL_KEY = 'Echo/v1/key'
export const LABEL_NONCE = 'Echo/v1/nonce'
export const LABEL_CONFIRM = 'Echo/v1/confirm'
export const LABEL_SECRET = 'Echo/v1/secret'

// TreeKEM Path Secret Chain
// Also pass through encodeHKDFLabel.
export const LABEL_PATH = 'Echo/v1/path'
export const LABEL_NODE = 'Echo/v1/node'
export const LABEL_COMMIT = 'Echo/v1/commit'

// HPKE Info Strings
export const HPKE_WELCOME_WRAP_INFO = 'Echo/v1/HPKE/WelcomeWrap'
export const HPKE_PATH_SECRET_WRAP_INFO = 'Echo/v1/HPKE/PathSecretWrap'

// AAD Domain Prefixes
// Consumers append '|<dynamic parts>' to form the full AAD string.
export const AAD_COMMIT_PREFIX = 'Echo/v1/Commit'
export const AAD_PATH_SECRET_PREFIX = 'Echo/v1/PathSecret'

// Signing Domain Separators
export const SIG_COMMIT_DOMAIN = 'Echo/v1/CommitSig'
export const SIG_WELCOME_DOMAIN = 'Echo/v1/WelcomeSig'

// Tree Hash Domain Prefixes
// Consumers append '|<serialized node>' to form the hash input.
export const TREE_HASH_BLANK = 'Echo/v1/blank'
export const TREE_HASH_LEAF = 'Echo/v1/leaf'
export const TREE_HASH_PARENT = 'Echo/v1/parent'
export const TREE_HASH_PHASH = 'Echo/v1/phash'

// Struct Domain Separators (credential / KeyPackage / proposal signing)
export const DOMAIN_CREDENTIAL = 'Echo/v1/Credential'
export const DOMAIN_KEY_PACKAGE = 'Echo/v1/KeyPackage'
export const DOMAIN_PROPOSAL = 'Echo/v1/Proposal'

// Protocol Version
export const PROTOCOL_VERSION = 'Echo/v1'
