// Imports - use your existing WASM modules
import init, { encrypt as wasmEncrypt, decrypt as wasmDecrypt } from '@mascaro101/echo-protocol'
import { argon2id } from '@noble/hashes/argon2.js'

// Constants
const DB_NAME = 'EchoEncryptedDB'
const DB_VERSION = 11

const STORES = {
  META: 'meta',
  IDENTITY_KEYS: 'identity_keys',
  PEER_IDENTITY_KEYS: 'peer_identity_keys',
  SESSION_KEYS: 'session_keys',
  MESSAGES: 'messages',
  MEDIA: 'media',
  ROOT_KEYS: 'root_keys',
  SENDING_CHAIN_KEYS: 'sending_chain_keys',
  RECEIVING_CHAIN_KEYS: 'receiving_chain_keys',
  CURRENT_SENDING_NUMBER: 'current_sending_number',
  CURRENT_RECEIVING_NUMBER: 'current_receiving_number',
  PREVIOUS_SENDING_NUMBER: 'previous_sending_number',
  SKIPPED_MESSAGE_KEYS: 'skipped_message_keys',
  OPK_PRIVATE_KEYS: 'opk_private_keys',
  MLS_GROUP_STATES: 'mls_group_states',
}

class EncryptedLocalDatabase {
  constructor() {
    this.db = null // IndexedDB instance
    this.dek = null // Database Encryption Key
    this.currentUserId = null // Who is logged in
    this._instanceId = Math.random().toString(36).substr(2, 9)
  }

  async initializeDB() {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Create each object store with indexes
        // META store - no index needed
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: 'id' })
        }

        // IDENTITY_KEYS - index by userId
        if (!db.objectStoreNames.contains(STORES.IDENTITY_KEYS)) {
          const store = db.createObjectStore(STORES.IDENTITY_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // PEER_IDENTITY_KEYS - index by userId + peerId
        if (!db.objectStoreNames.contains(STORES.PEER_IDENTITY_KEYS)) {
          const store = db.createObjectStore(STORES.PEER_IDENTITY_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
          store.createIndex('peerId', 'peerId', { unique: false })
        }

        // SESSION_KEYS - index by userId
        if (!db.objectStoreNames.contains(STORES.SESSION_KEYS)) {
          const store = db.createObjectStore(STORES.SESSION_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // MESSAGES - index by conversationId and userId
        if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
          const store = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' })
          store.createIndex('conversationId', 'conversationId', { unique: false })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // MEDIA - index by userId
        if (!db.objectStoreNames.contains(STORES.MEDIA)) {
          const store = db.createObjectStore(STORES.MEDIA, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // ROOT_KEYS - index by userId
        if (!db.objectStoreNames.contains(STORES.ROOT_KEYS)) {
          const store = db.createObjectStore(STORES.ROOT_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // SENDING_CHAIN_KEYS - index by userId
        if (!db.objectStoreNames.contains(STORES.SENDING_CHAIN_KEYS)) {
          const store = db.createObjectStore(STORES.SENDING_CHAIN_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // RECEIVING_CHAIN_KEYS - index by userId
        if (!db.objectStoreNames.contains(STORES.RECEIVING_CHAIN_KEYS)) {
          const store = db.createObjectStore(STORES.RECEIVING_CHAIN_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // CURRENT_SENDING_NUMBER - index by userId
        if (!db.objectStoreNames.contains(STORES.CURRENT_SENDING_NUMBER)) {
          const store = db.createObjectStore(STORES.CURRENT_SENDING_NUMBER, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // CURRENT_RECEIVING_NUMBER - index by userId
        if (!db.objectStoreNames.contains(STORES.CURRENT_RECEIVING_NUMBER)) {
          const store = db.createObjectStore(STORES.CURRENT_RECEIVING_NUMBER, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // PREVIOUS_SENDING_NUMBER - index by userId
        if (!db.objectStoreNames.contains(STORES.PREVIOUS_SENDING_NUMBER)) {
          const store = db.createObjectStore(STORES.PREVIOUS_SENDING_NUMBER, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // SKIPPED_MESSAGE_KEYS - index by userId
        if (!db.objectStoreNames.contains(STORES.SKIPPED_MESSAGE_KEYS)) {
          const store = db.createObjectStore(STORES.SKIPPED_MESSAGE_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // OPK_PRIVATE_KEYS - one record per opkId, indexed by userId
        if (!db.objectStoreNames.contains(STORES.OPK_PRIVATE_KEYS)) {
          const store = db.createObjectStore(STORES.OPK_PRIVATE_KEYS, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
        }

        // MLS_GROUP_STATES - index by groupId
        if (!db.objectStoreNames.contains(STORES.MLS_GROUP_STATES)) {
          const store = db.createObjectStore(STORES.MLS_GROUP_STATES, { keyPath: 'id' })
          store.createIndex('groupId', 'groupId', { unique: true })
          store.createIndex('userId', 'userId', { unique: false })
        } else {
          const tx = event.target.transaction
          const store = tx.objectStore(STORES.MLS_GROUP_STATES)
          if (!store.indexNames.contains('userId')) {
            store.createIndex('userId', 'userId', { unique: false })
          }
        }
      }
    })
  }

  async _openStore(storeName, mode) {
    await this.initializeDB()

    if (!this.db.objectStoreNames.contains(storeName)) {
      // If code expects a newer schema than the current open handle, reopen once.
      if (this.db.version < DB_VERSION) {
        this.db.close()
        this.db = null
        await this.initializeDB()
      }

      if (!this.db.objectStoreNames.contains(storeName)) {
        throw new Error(
          `IndexedDB store "${storeName}" is missing. Reload the app to apply the latest local database migration.`
        )
      }
    }

    const tx = this.db.transaction(storeName, mode)
    return { tx, store: tx.objectStore(storeName) }
  }

  // PUT - insert or update a record
  async _put(storeName, record) {
    const { store } = await this._openStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(record)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // PUT BATCH - insert or update multiple records in a single transaction
  async _putBatch(storeName, records) {
    if (!records.length) return
    const { tx, store } = await this._openStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
      for (const record of records) {
        store.put(record)
      }
    })
  }

  // GET - retrieve by primary key
  async _get(storeName, key) {
    const { store } = await this._openStore(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // DELETE - remove by primary key
  async _delete(storeName, key) {
    const { store } = await this._openStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // GET ALL BY INDEX - retrieve all records matching an index value
  async _getAllByIndex(storeName, indexName, value) {
    const { store } = await this._openStore(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const index = store.index(indexName)
      const request = index.getAll(value)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async _deleteAllByIndex(storeName, indexName, value) {
    const records = await this._getAllByIndex(storeName, indexName, value)
    for (const record of records) {
      if (record?.id != null) await this._delete(storeName, record.id)
    }
    return records.length
  }

  // Convert Uint8Array to Base64 string
  _uint8ToBase64(arr) {
    return btoa(String.fromCharCode.apply(null, arr))
  }

  // Convert Base64 string back to Uint8Array
  _base64ToUint8(base64) {
    const binary = atob(base64)
    const arr = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      arr[i] = binary.charCodeAt(i)
    }
    return arr
  }

  // Generate 12-byte random nonce for AES-GCM
  _generateNonce() {
    return crypto.getRandomValues(new Uint8Array(12))
  }

  // Generate 32-byte random salt for key derivation
  _generateSalt() {
    return crypto.getRandomValues(new Uint8Array(32))
  }

  // Throw error if database is locked
  _ensureUnlocked() {
    if (this.dek == null || this.currentUserId == null) {
      console.error('[ELD] Lock check failed on instance:', this._instanceId)
      throw new Error('Database is locked. Call unlock() first.')
    }
  }

  // Check if unlocked
  isUnlocked() {
    return this.dek != null && this.currentUserId != null
  }

  async _deriveKey(password, salt) {
    const encoder = new TextEncoder()
    const passwordBytes = encoder.encode(password)

    // Argon2id: memory-hard password KDF (OWASP interactive profile)
    // m=65536 KiB (64 MB), t=3 iterations, p=1 lane
    const derived = argon2id(passwordBytes, salt, {
      t: 3,
      m: 65536,
      p: 1,
      dkLen: 32,
    })

    return new Uint8Array(derived)
  }

  async _encrypt(data) {
    this._ensureUnlocked()
    await init() // Initialize aes-wasm

    // Convert object to JSON string
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data)

    // Generate random nonce
    const nonce = this._generateNonce()

    // Encrypt using your WASM module
    const ciphertext = await wasmEncrypt(plaintext, this.dek, nonce)

    return {
      ciphertext, // Hex string from WASM
      nonce: this._uint8ToBase64(nonce), // Base64 for storage
    }
  }

  async _decrypt(ciphertext, nonceBase64) {
    this._ensureUnlocked()
    await init()

    const nonce = this._base64ToUint8(nonceBase64)
    return await wasmDecrypt(ciphertext, this.dek, nonce)
  }

  // Check if user has a database
  async userExists(userId) {
    await this.initializeDB()
    const meta = await this._get(STORES.META, `user-${userId}`)
    return !!meta
  }

  async resetUser(userId) {
    if (userId == null || userId === '') {
      throw new Error('Missing userId.')
    }

    await this.initializeDB()

    if (this.currentUserId === userId) {
      this.lock()
    }

    const storesWithUserId = [
      STORES.IDENTITY_KEYS,
      STORES.PEER_IDENTITY_KEYS,
      STORES.SESSION_KEYS,
      STORES.MESSAGES,
      STORES.MEDIA,
      STORES.ROOT_KEYS,
      STORES.SENDING_CHAIN_KEYS,
      STORES.RECEIVING_CHAIN_KEYS,
      STORES.CURRENT_SENDING_NUMBER,
      STORES.CURRENT_RECEIVING_NUMBER,
      STORES.PREVIOUS_SENDING_NUMBER,
      STORES.SKIPPED_MESSAGE_KEYS,
      STORES.OPK_PRIVATE_KEYS,
      STORES.MLS_GROUP_STATES,
    ]

    for (const storeName of storesWithUserId) {
      if (!this.db.objectStoreNames.contains(storeName)) continue
      await this._deleteAllByIndex(storeName, 'userId', userId)
    }

    await this._delete(STORES.META, `user-${userId}`)
    await this._delete(STORES.META, `verify-${userId}`)
  }

  // First-time setup for a new user
  async createUser(userId, password) {
    if (userId == null || userId === '') {
      throw new Error('Missing userId. Registration/login must return a userId.')
    }
    if (password == null || password === '') {
      throw new Error('Missing password.')
    }

    await this.initializeDB()

    if (await this.userExists(userId)) {
      // Detect partial state: salt written but verify record missing (failed previous attempt).
      // Reset so a fresh registration can proceed instead of getting permanently stuck.
      const verify = await this._get(STORES.META, `verify-${userId}`)
      if (!verify) {
        await this.resetUser(userId)
      } else {
        throw new Error('User already exists. Use unlock() instead.')
      }
    }

    // Generate and store salt (unencrypted - needed for key derivation)
    const salt = this._generateSalt()

    await this._put(STORES.META, {
      id: `user-${userId}`,
      salt: this._uint8ToBase64(salt),
      kdfVersion: 'argon2id-v1',
      createdAt: Date.now(),
    })

    // Derive DEK and set state
    const derivedKey = await this._deriveKey(password, salt)

    this.dek = derivedKey
    this.currentUserId = userId

    if (!this.dek || this.dek.length !== 32) {
      throw new Error('Failed to derive encryption key')
    }

    // Store verification record (to check password on future logins)
    const verification = await this._encrypt('echo-verify-ok')

    await this._put(STORES.META, {
      id: `verify-${userId}`,
      ...verification,
    })
  }

  // Unlock existing user's database
  async unlock(userId, password) {
    await this.initializeDB()

    if (userId == null || userId === '') {
      throw new Error('Missing userId.')
    }
    if (password == null || password === '') {
      throw new Error('Missing password.')
    }

    if (!(await this.userExists(userId))) {
      throw new Error('User does not exist. Use createUser() first.')
    }

    // Get salt
    const meta = await this._get(STORES.META, `user-${userId}`)
    const salt = this._base64ToUint8(meta.salt)

    // Derive DEK
    this.dek = await this._deriveKey(password, salt)
    this.currentUserId = userId

    // Verify password by decrypting test record
    try {
      const verifyRecord = await this._get(STORES.META, `verify-${userId}`)
      if (verifyRecord) {
        const result = await this._decrypt(verifyRecord.ciphertext, verifyRecord.nonce)
        if (result !== 'echo-verify-ok') {
          throw new Error('Mismatch')
        }
      }
    } catch {
      this.lock() // Clear DEK on failure
      throw new Error('Invalid password')
    }

    return true
  }

  // Lock the database (logout)
  lock() {
    if (this.dek) {
      this.dek.fill(0) // Zero out memory for security
    }
    this.dek = null
    this.currentUserId = null
  }

  async storePeerIdentityKey(peerId, keys) {
    this._ensureUnlocked()

    if (peerId == null || peerId === '') {
      throw new Error('Missing peerId')
    }
    if (keys == null) {
      throw new Error('Missing peer identity keys')
    }

    const encrypted = await this._encrypt(keys)

    // Do NOT sort: this record belongs to the *current* user and a specific peer.
    const peerIdentityKeyId = `${this.currentUserId}->${peerId}`

    await this._put(STORES.PEER_IDENTITY_KEYS, {
      id: `peerIdentityKey-${peerIdentityKeyId}`,
      userId: this.currentUserId,
      peerId,
      updatedAt: Date.now(),
      ...encrypted,
    })
  }

  async getPeerIdentityKey(peerId) {
    this._ensureUnlocked()
    if (peerId == null || peerId === '') return null

    const peerIdentityKeyId = `${this.currentUserId}->${peerId}`
    const record = await this._get(
      STORES.PEER_IDENTITY_KEYS,
      `peerIdentityKey-${peerIdentityKeyId}`
    )
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted)
  }

  async storeIdentityKeys(keys) {
    this._ensureUnlocked()
    const encrypted = await this._encrypt(keys)
    await this._put(STORES.IDENTITY_KEYS, {
      id: `identity-${this.currentUserId}`,
      userId: this.currentUserId,
      ...encrypted,
    })
  }

  async getIdentityKeys() {
    this._ensureUnlocked()
    const record = await this._get(STORES.IDENTITY_KEYS, `identity-${this.currentUserId}`)
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted)
  }

  // Receiving Chain Keys

  async storeReceivingChainKey(peerId, receivingChainKey) {
    this._ensureUnlocked()
    if (!(receivingChainKey instanceof Uint8Array) || receivingChainKey.length !== 32) {
      throw new Error(
        `Invalid receiving chain key length: ${receivingChainKey?.length} (expected 32)`
      )
    }
    const receivingKeyChainId = [this.currentUserId, peerId].sort().join('-')

    const data = {
      receivingChainKey: this._uint8ToBase64(receivingChainKey),
      peerId,
      updatedAt: Date.now(),
    }
    const encrypted = await this._encrypt(data)
    await this._put(STORES.RECEIVING_CHAIN_KEYS, {
      id: `receivingChainKey-${receivingKeyChainId}`,
      userId: this.currentUserId,
      receivingKeyChainId,
      ...encrypted,
    })
  }

  async getReceivingChainKey(peerId) {
    this._ensureUnlocked()
    const receivingKeyChainId = [this.currentUserId, peerId].sort().join('-')
    const record = await this._get(
      STORES.RECEIVING_CHAIN_KEYS,
      `receivingChainKey-${receivingKeyChainId}`
    )
    if (!record) return null

    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    const data = JSON.parse(decrypted)
    const key =
      typeof data.receivingChainKey === 'string'
        ? this._base64ToUint8(data.receivingChainKey)
        : data.receivingChainKey
    if (!(key instanceof Uint8Array) || key.length !== 32) {
      console.warn('[ELD] Invalid receiving chain key stored; deleting invalid entry')
      await this.deleteReceivingChainKey(peerId)
      return null
    }
    return { receivingChainKey: key }
  }

  async deleteReceivingChainKey(peerId) {
    this._ensureUnlocked()
    const receivingKeyChainId = [this.currentUserId, peerId].sort().join('-')
    await this._delete(STORES.RECEIVING_CHAIN_KEYS, `receivingChainKey-${receivingKeyChainId}`)
  }

  // Sending Chain Keys

  async storeSendingChainKey(peerId, sendingChainKey) {
    this._ensureUnlocked()
    if (!(sendingChainKey instanceof Uint8Array) || sendingChainKey.length !== 32) {
      throw new Error(`Invalid sending chain key length: ${sendingChainKey?.length} (expected 32)`)
    }
    const sendingKeyChainId = [this.currentUserId, peerId].sort().join('-')

    const data = {
      sendingChainKey: this._uint8ToBase64(sendingChainKey),
      peerId,
      updatedAt: Date.now(),
    }
    const encrypted = await this._encrypt(data)
    await this._put(STORES.SENDING_CHAIN_KEYS, {
      id: `sendingChainKey-${sendingKeyChainId}`,
      userId: this.currentUserId,
      sendingKeyChainId,
      ...encrypted,
    })
  }

  async getSendingChainKey(peerId) {
    this._ensureUnlocked()
    const sendingKeyChainId = [this.currentUserId, peerId].sort().join('-')
    const record = await this._get(
      STORES.SENDING_CHAIN_KEYS,
      `sendingChainKey-${sendingKeyChainId}`
    )
    if (!record) return null

    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    const data = JSON.parse(decrypted)
    const key =
      typeof data.sendingChainKey === 'string'
        ? this._base64ToUint8(data.sendingChainKey)
        : data.sendingChainKey
    if (!(key instanceof Uint8Array) || key.length !== 32) {
      console.warn('[ELD] Invalid sending chain key stored; deleting invalid entry')
      await this.deleteSendingChainKey(peerId)
      return null
    }
    return { sendingChainKey: key }
  }

  async deleteSendingChainKey(peerId) {
    this._ensureUnlocked()
    const sendingKeyChainId = [this.currentUserId, peerId].sort().join('-')
    await this._delete(STORES.SENDING_CHAIN_KEYS, `sendingChainKey-${sendingKeyChainId}`)
  }

  async deleteRootKey(peerId) {
    this._ensureUnlocked()
    const rootKeyId = [this.currentUserId, peerId].sort().join('-')
    await this._delete(STORES.ROOT_KEYS, `root-${rootKeyId}`)
  }

  // ROOT KEYS

  async storeRootKey(peerId, rootKey) {
    this._ensureUnlocked()
    if (!(rootKey instanceof Uint8Array) || rootKey.length !== 32) {
      throw new Error(`Invalid root key length: ${rootKey?.length} (expected 32)`)
    }
    const rootKeyId = [this.currentUserId, peerId].sort().join('-')

    const data = {
      rootKey: this._uint8ToBase64(rootKey),
      peerId,
      updatedAt: Date.now(),
    }
    const encrypted = await this._encrypt(data)
    await this._put(STORES.ROOT_KEYS, {
      id: `root-${rootKeyId}`,
      userId: this.currentUserId,
      rootKeyId,
      ...encrypted,
    })
  }

  async getRootKey(peerId) {
    this._ensureUnlocked()
    const root_key = [this.currentUserId, peerId].sort().join('-')
    const record = await this._get(STORES.ROOT_KEYS, `root-${root_key}`)
    if (!record) return null

    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    const data = JSON.parse(decrypted)
    const key = typeof data.rootKey === 'string' ? this._base64ToUint8(data.rootKey) : data.rootKey
    if (!(key instanceof Uint8Array) || key.length !== 32) {
      console.warn('[ELD] Invalid ROOT key stored; deleting invalid entry')
      await this.deleteRootKey(peerId)
      return null
    }
    return { rootKey: key }
  }

  //MESSAGES

  async storeMessage(peerId, message) {
    this._ensureUnlocked()
    const conversationId = [this.currentUserId, peerId].sort().join('-')
    const msgId = message._id || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const encrypted = await this._encrypt(message)
    await this._put(STORES.MESSAGES, {
      id: msgId,
      userId: this.currentUserId,
      conversationId,
      timestamp: message.createdAt || Date.now(),
      ...encrypted,
    })
  }

  async getMessages(peerId) {
    this._ensureUnlocked()
    const conversationId = [this.currentUserId, peerId].sort().join('-')
    const records = await this._getAllByIndex(STORES.MESSAGES, 'conversationId', conversationId)

    const messages = []
    for (const record of records) {
      try {
        const decrypted = await this._decrypt(record.ciphertext, record.nonce)
        messages.push(JSON.parse(decrypted))
      } catch {
        console.warn('[ELD] Failed to decrypt message')
      }
    }

    return messages.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  }

  async exportMessagesForCurrentUser() {
    this._ensureUnlocked()
    const records = await this._getAllByIndex(STORES.MESSAGES, 'userId', this.currentUserId)
    const messages = []

    for (const record of records) {
      try {
        const decrypted = await this._decrypt(record.ciphertext, record.nonce)
        messages.push({
          peerId: this._peerIdFromConversationId(record.conversationId),
          conversationId: record.conversationId,
          message: JSON.parse(decrypted),
        })
      } catch {
        console.warn('[ELD] Failed to decrypt message during export')
      }
    }

    return messages.sort(
      (a, b) => new Date(a.message?.createdAt || 0) - new Date(b.message?.createdAt || 0)
    )
  }

  async importMessagesForCurrentUser(entries) {
    this._ensureUnlocked()
    if (!Array.isArray(entries)) return 0

    let imported = 0
    for (const entry of entries) {
      const peerId = entry?.peerId || this._peerIdFromConversationId(entry?.conversationId)
      if (!peerId || !entry?.message) continue
      await this.storeMessage(peerId, entry.message)
      imported += 1
    }

    return imported
  }

  _peerIdFromConversationId(conversationId) {
    if (!conversationId || !this.currentUserId) return null
    const prefix = `${this.currentUserId}-`
    const suffix = `-${this.currentUserId}`
    if (conversationId.startsWith(prefix)) return conversationId.slice(prefix.length)
    if (conversationId.endsWith(suffix)) return conversationId.slice(0, -suffix.length)
    return conversationId
  }

  // ============== EPHEMERAL KEYS ==============

  async storeEphemeralData(peerId, data) {
    this._ensureUnlocked()
    const sessionId = [this.currentUserId, peerId].sort().join('-')
    const encrypted = await this._encrypt(data)

    await this._put(STORES.SESSION_KEYS, {
      id: `ephemeral-${sessionId}`,
      sessionId,
      userId: this.currentUserId,
      type: 'ephemeral',
      ...encrypted,
    })
  }

  async getEphemeralData(peerId) {
    this._ensureUnlocked()
    const sessionId = [this.currentUserId, peerId].sort().join('-')
    const record = await this._get(STORES.SESSION_KEYS, `ephemeral-${sessionId}`)
    if (!record) return null

    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted)
  }

  async deleteEphemeralData(peerId) {
    this._ensureUnlocked()
    const sessionId = [this.currentUserId, peerId].sort().join('-')
    await this._delete(STORES.SESSION_KEYS, `ephemeral-${sessionId}`)
  }

  // ============== UTILITY ==============

  getCurrentUserId() {
    return this.currentUserId
  }

  // MESSAGE NUMBERS

  async storeCurrentSendingNumber(peerId, number) {
    this._ensureUnlocked()
    const id = `currentSendingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    const encrypted = await this._encrypt({ number })
    await this._put(STORES.CURRENT_SENDING_NUMBER, {
      id,
      userId: this.currentUserId,
      ...encrypted,
    })
  }

  async getCurrentNs(peerId) {
    this._ensureUnlocked()
    const id = `currentSendingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    const record = await this._get(STORES.CURRENT_SENDING_NUMBER, id)
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted).number
  }

  async storeCurrentReceivingNumber(peerId, number) {
    this._ensureUnlocked()
    const id = `currentReceivingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    const encrypted = await this._encrypt({ number })
    await this._put(STORES.CURRENT_RECEIVING_NUMBER, {
      id,
      userId: this.currentUserId,
      ...encrypted,
    })
  }

  async getCurrentNr(peerId) {
    this._ensureUnlocked()
    const id = `currentReceivingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    const record = await this._get(STORES.CURRENT_RECEIVING_NUMBER, id)
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted).number
  }

  async storePreviousSendingNumber(peerId, number) {
    this._ensureUnlocked()
    const id = `previousSendingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    const encrypted = await this._encrypt({ number })
    await this._put(STORES.PREVIOUS_SENDING_NUMBER, {
      id,
      userId: this.currentUserId,
      ...encrypted,
    })
  }

  async getPn(peerId) {
    this._ensureUnlocked()
    const id = `previousSendingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    const record = await this._get(STORES.PREVIOUS_SENDING_NUMBER, id)
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted).number
  }

  async storeSkippedMessageKeys(peerId, skippedKeys) {
    this._ensureUnlocked()
    const id = `skippedMessageKeys-${[this.currentUserId, peerId].sort().join('-')}`
    const encrypted = await this._encrypt({ skippedKeys })
    await this._put(STORES.SKIPPED_MESSAGE_KEYS, {
      id,
      userId: this.currentUserId,
      ...encrypted,
    })
  }

  async getSkippedMessageKeys(peerId) {
    this._ensureUnlocked()
    const id = `skippedMessageKeys-${[this.currentUserId, peerId].sort().join('-')}`
    const record = await this._get(STORES.SKIPPED_MESSAGE_KEYS, id)
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted).skippedKeys
  }

  async deleteCurrentSendingNumber(peerId) {
    this._ensureUnlocked()
    const id = `currentSendingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    await this._delete(STORES.CURRENT_SENDING_NUMBER, id)
  }

  async deleteCurrentReceivingNumber(peerId) {
    this._ensureUnlocked()
    const id = `currentReceivingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    await this._delete(STORES.CURRENT_RECEIVING_NUMBER, id)
  }

  async deletePreviousSendingNumber(peerId) {
    this._ensureUnlocked()
    const id = `previousSendingNumber-${[this.currentUserId, peerId].sort().join('-')}`
    await this._delete(STORES.PREVIOUS_SENDING_NUMBER, id)
  }

  async deleteSkippedMessageKeys(peerId) {
    this._ensureUnlocked()
    const id = `skippedMessageKeys-${[this.currentUserId, peerId].sort().join('-')}`
    await this._delete(STORES.SKIPPED_MESSAGE_KEYS, id)
  }

  // OPK PRIVATE KEYS

  // Store a batch of OPK private keys: opks is an array of { opkId, privateKey (Uint8Array) }
  async storeOPKs(opks) {
    this._ensureUnlocked()
    // Encrypt all records outside of any IDB transaction first, then write in one shot.
    // Opening 100 separate transactions (one per OPK) triggers "Internal error" in some
    // browsers when too many sequential transactions are issued against the same store.
    const records = []
    for (const { opkId, privateKey } of opks) {
      const encrypted = await this._encrypt({ privateKey: this._uint8ToBase64(privateKey) })
      records.push({
        id: `opk-${opkId}`,
        userId: this.currentUserId,
        opkId,
        ...encrypted,
      })
    }
    await this._putBatch(STORES.OPK_PRIVATE_KEYS, records)
  }

  // Retrieve the private key for a single opkId (returns Uint8Array or null)
  async getOPK(opkId) {
    this._ensureUnlocked()
    const record = await this._get(STORES.OPK_PRIVATE_KEYS, `opk-${opkId}`)
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    const data = JSON.parse(decrypted)
    return this._base64ToUint8(data.privateKey)
  }

  // Delete a consumed OPK (call after using it in X3DH response)
  async deleteOPK(opkId) {
    this._ensureUnlocked()
    await this._delete(STORES.OPK_PRIVATE_KEYS, `opk-${opkId}`)
  }

  // Return the count of remaining stored OPKs
  async getOPKCount() {
    this._ensureUnlocked()
    const records = await this._getAllByIndex(STORES.OPK_PRIVATE_KEYS, 'userId', this.currentUserId)
    return records.length
  }

  async storeMlsGroupState(groupId, state) {
    this._ensureUnlocked()
    const encrypted = await this._encrypt(state)
    await this._put(STORES.MLS_GROUP_STATES, {
      id: `mlsGroupState-${groupId}`,
      groupId,
      userId: this.currentUserId,
      updatedAt: Date.now(),
      ...encrypted,
    })
  }

  async getMlsGroupState(groupId) {
    this._ensureUnlocked()
    const record = await this._get(STORES.MLS_GROUP_STATES, `mlsGroupState-${groupId}`)
    if (!record) return null
    const decrypted = await this._decrypt(record.ciphertext, record.nonce)
    return JSON.parse(decrypted)
  }

  async exportMlsGroupStatesForCurrentUser() {
    this._ensureUnlocked()
    const records = await this._getAllByIndex(STORES.MLS_GROUP_STATES, 'userId', this.currentUserId)
    const states = []

    for (const record of records) {
      try {
        const decrypted = await this._decrypt(record.ciphertext, record.nonce)
        states.push({ groupId: record.groupId, state: JSON.parse(decrypted) })
      } catch {
        console.warn('[ELD] Failed to decrypt MLS group state during export')
      }
    }

    return states
  }

  async importMlsGroupStatesForCurrentUser(entries) {
    this._ensureUnlocked()
    if (!Array.isArray(entries)) return 0

    let imported = 0
    for (const entry of entries) {
      if (!entry?.groupId || entry.state == null) continue
      await this.storeMlsGroupState(entry.groupId, entry.state)
      imported += 1
    }

    return imported
  }

  async deleteMlsGroupState(groupId) {
    this._ensureUnlocked()
    await this._delete(STORES.MLS_GROUP_STATES, `mlsGroupState-${groupId}`)
  }

  // ── Session state bulk export / import ────────────────────────────────────────
  // Exports DR ratchet state (chain keys, root keys, message counters, OPKs,
  // peer identity keys, ephemeral session data) as decrypted plaintext so they
  // can be re-encrypted with the receiving device's own DEK on import.

  async exportSessionDataForCurrentUser() {
    this._ensureUnlocked()

    const SESSION_STORES = [
      STORES.ROOT_KEYS,
      STORES.SENDING_CHAIN_KEYS,
      STORES.RECEIVING_CHAIN_KEYS,
      STORES.CURRENT_SENDING_NUMBER,
      STORES.CURRENT_RECEIVING_NUMBER,
      STORES.PREVIOUS_SENDING_NUMBER,
      STORES.SKIPPED_MESSAGE_KEYS,
      STORES.SESSION_KEYS,
      STORES.OPK_PRIVATE_KEYS,
      STORES.PEER_IDENTITY_KEYS,
    ]

    const result = {}
    for (const storeName of SESSION_STORES) {
      if (!this.db.objectStoreNames.contains(storeName)) continue
      const records = await this._getAllByIndex(storeName, 'userId', this.currentUserId)
      if (records.length === 0) continue

      const exported = []
      for (const record of records) {
        try {
          const plaintext = await this._decrypt(record.ciphertext, record.nonce)
          // Strip the encrypted fields; keep all structural fields (id, userId, indexes).
          const rest = { ...record }
          delete rest.ciphertext
          delete rest.nonce
          exported.push({ ...rest, _plaintext: plaintext })
        } catch {
          // skip corrupted records
        }
      }
      if (exported.length > 0) result[storeName] = exported
    }

    return result
  }

  async importSessionDataForCurrentUser(sessionData) {
    this._ensureUnlocked()
    if (!sessionData || typeof sessionData !== 'object') return

    for (const [storeName, records] of Object.entries(sessionData)) {
      if (!this.db.objectStoreNames.contains(storeName)) continue
      if (!Array.isArray(records)) continue

      for (const entry of records) {
        try {
          const { _plaintext, ...rest } = entry
          rest.userId = this.currentUserId
          const encrypted = await this._encrypt(_plaintext)
          await this._put(storeName, { ...rest, ...encrypted })
        } catch {
          // skip records that fail to re-encrypt
        }
      }
    }
  }
}
// Create singleton instance
const eld = new EncryptedLocalDatabase()

export default eld
export { EncryptedLocalDatabase, STORES }
