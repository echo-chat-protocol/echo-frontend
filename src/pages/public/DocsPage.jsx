import { useState } from "react";
import {
  BookOpen,
  Code2,
  Server,
  KeyRound,
  Search,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "@/components/layout/PageShell";

const SECTIONS = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting started",
    subsections: [
      { id: "install-echo", title: "Install ECHO in 60 seconds" },
      { id: "generate-keypair", title: "Generate your first keypair" },
      { id: "verify-fingerprint", title: "Verify a contact's fingerprint" },
      { id: "create-group", title: "Create your first group" },
    ],
  },
  {
    id: "developer-sdk",
    icon: Code2,
    title: "Developer SDK",
    subsections: [
      { id: "sdk-typescript", title: "@echo/sdk for TypeScript" },
      { id: "sdk-rust", title: "echo-rs (Rust crate)" },
      { id: "sdk-swift", title: "echo-swift" },
      { id: "sdk-kotlin", title: "echo-kotlin" },
      { id: "rest-relay", title: "REST relay protocol" },
    ],
  },
  {
    id: "self-hosting",
    icon: Server,
    title: "Self-hosting",
    subsections: [
      { id: "deploy-docker", title: "Deploy a relay on Docker" },
      { id: "federation", title: "Federation with other nodes" },
      { id: "backups", title: "Backups & disaster recovery" },
      { id: "observability", title: "Observability (Prometheus / OTLP)" },
    ],
  },
  {
    id: "cryptography",
    icon: KeyRound,
    title: "Cryptography",
    subsections: [
      { id: "key-derivation", title: "Key derivation (Argon2id)" },
      { id: "double-ratchet", title: "Double Ratchet specification" },
      { id: "mls-group-epochs", title: "MLS group epochs" },
      { id: "hybrid-pq", title: "Hybrid PQ handshake (Kyber + X25519)" },
    ],
  },
];

const contentMap = {
  "install-echo": {
    title: "Install ECHO in 60 seconds",
    content: `Getting ECHO up and running is incredibly fast. You can install the ECHO CLI and core SDK using our automated script or package managers.

When you install ECHO, you are not just downloading a tool; you are stepping into a completely new paradigm of secure, decentralized communication. Our installation scripts have been meticulously engineered to ensure that dependencies are correctly mapped, binaries are natively compiled for your architecture, and the cryptographic primitives are securely initialized in your operating system's enclave.

### 1. Automated Shell Installation
The fastest way to install the command-line interface on Unix-like operating systems is via our verified installation script:

\`\`\`bash
curl -fsSL https://echo.io/cli | sh
\`\`\`

The automated script above will detect your OS (Linux, macOS, or Windows via WSL), fetch the latest stable release, verify its GPG signature to prevent supply-chain attacks, and place it in your /usr/local/bin or equivalent path. It will also initialize a default configuration file in your home directory, setting up the basic scaffolding for your future projects.

### 2. Manual Package Management
If you prefer deterministic dependency management through native system repositories, we maintain verified packages for multiple ecosystems:

**macOS (Homebrew):**
\`\`\`bash
brew install echoprotocol/tap/echo-cli
\`\`\`

**Linux (Debian/Ubuntu):**
\`\`\`bash
sudo apt-get update && sudo apt-get install -y echo-cli
\`\`\`

### 3. Integrating the TypeScript SDK
For Node.js, Deno, or Bun frontend/backend applications, install the core developer SDK via your preferred runtime package manager:

\`\`\`bash
npm install @echo/sdk
# or alternatively
pnpm add @echo/sdk
yarn add @echo/sdk
\`\`\`

Using npm allows you to seamlessly integrate ECHO's capabilities into your existing TypeScript or JavaScript codebase. The package is lightweight and relies on WebAssembly for heavy cryptographic lifting, ensuring that your application remains blazing fast.

Verify your local installation by querying the client runtime configuration:

\`\`\`bash
echo-cli --version && echo-cli status
\`\`\`

If everything went well, you should see the version number printed on your terminal along with an initialized local cryptographic state. Welcome to the future of secure communication!`,
  },
  "generate-keypair": {
    title: "Generate your first keypair",
    content: `ECHO uses advanced asymmetric cryptography to ensure absolute privacy. Before sending or receiving network packets, your client must provision a cryptographic identity keypair.

The concept of a keypair is fundamental to asymmetric cryptography. Think of the public key as your digital address—something you can safely share with anyone in the world so they can send you encrypted messages. The private key, on the other hand, is the mathematical secret that allows only you to unlock and read those messages.

### The Underlying Mechanics
The key generation process uses Argon2id for key stretching and generates an Ed25519 identity key. This specific combination was chosen after rigorous peer review by independent security researchers. Argon2id protects against GPU-based brute-force attacks and side-channel memory timing attacks, while Ed25519 provides extremely fast, high-security elliptic curve operations without the risk of invalid curve vulnerabilities.

When a client requests a new identity, the SDK orchestrates the following low-level routine:

\`\`\`javascript
import { crypto, IdentityStorage } from '@echo/sdk';

// 1. Generate a cryptographically secure 32-byte seed from the system entropy pool
const hardwareSeed = await crypto.getSecureRandomBytes(32);

// 2. Derive the Ed25519 identity keypair using the entropy seed
const identityKey = await crypto.generateIdentityKeyPair(hardwareSeed);

console.log('Identity Initialized Successfully.');
console.log('Public Identity Fingerprint Key:', identityKey.publicKey.toHex());
\`\`\`

### Secure Storage Policies
When you run this code, your processor gathers true entropy from the operating system's secure random number generator (like /dev/urandom on Unix systems or BCryptGenRandom Windows). This entropy is then used as the seed for the Ed25519 key derivation algorithm.

It is absolutely critical that you never share your private key, log it to the console, or commit it to version control systems like GitHub. If a malicious actor gains access to your private key, they can impersonate you perfectly across the entire ECHO network, forge signatures, and read all incoming historical asynchronous messages stored on the relay.`,
  },
  "verify-fingerprint": {
    title: "Verify a contact's fingerprint",
    content: `To prevent complex Man-in-the-Middle (MITM) attacks, the ECHO protocol requires users to perform an out-of-band verification of their contact's identity fingerprint.

A fingerprint (often called a Safety Number or Security Code) is a human-readable representation of a cryptographic public key. In the ECHO protocol, public keys are transmitted over the network when a conversation is initiated. However, if an attacker intercepts the network infrastructure, they could substitute their own public key. This is the classic MITM attack.

### The Mathematical Verification Model
To thwart network interception, ECHO computes a unique fingerprint derived from both your local identity public key and your contact's remote public key. You must compare this fingerprint with your contact through a secondary, trusted channel—such as an in-person meeting, a secure telephone call where you recognize their voice, or an established secure video feed.

The SDK computes this shared identity block utilizing the following execution pattern:

\`\`\`javascript
import { crypto } from '@echo/sdk';

// Fetch public keys from your verified local state storage
const localKey = client.identity.getPublicKey();
const remoteKey = client.contacts.get("alice@echo.dev").getPublicKey();

// Calculate the unique shared safety fingerprint
const fingerprint = await crypto.computeFingerprint(localKey, remoteKey);
console.log('Safety Number Block:', fingerprint.formatChunks());
\`\`\`

### Execution Breakdown
The algorithm used to compute the fingerprint hashes both keys using SHA-512, chunks the resulting byte array, and converts it into a visually distinct format (like a QR code or a series of formatted numbers).

If the fingerprint displayed on your screen matches the one on your contact's screen exactly, you can be mathematically certain that your connection is secure and no one is eavesdropping. If they do not match, you must immediately abort the connection and flag the routing node as compromised.`,
  },
  "create-group": {
    title: "Create your first group",
    content: `ECHO supports scalable, end-to-end encrypted group messaging by incorporating the modern IETF Messaging Layer Security (MLS) protocol architecture.

Creating a group establishes an initial group epoch and distributes KeyPackages to members. Group messaging in end-to-end encrypted systems has historically been incredibly inefficient, often requiring the sender to encrypt the same message individually for every single participant (the pairwise encryption problem).

### The Power of Ratchet Trees
ECHO solves this by implementing the IETF standard for Messaging Layer Security. MLS introduces a concept called Ratchet Trees. Instead of encrypting for individuals, members are arranged in a binary tree structure. This reduces the cryptographic complexity of adding, removing, or updating group members from O(N) to O(log N).

Here is how you programmatically instantiate an encrypted multi-party session using the TypeScript SDK:

\`\`\`javascript
import { Client } from '@echo/sdk';

const client = new Client({ identitySecretPath: './keys/id.key' });
await client.connect();

// Instantiate an multi-party MLS session
const group = await client.groups.create({
  name: "Global Engineering Operations",
  members: ["alice@echo.dev", "bob@echo.dev", "charlie@echo.dev"],
  policies: {
    allowExternalInvites: false,
    epochTimeoutMs: 86400000 // Force epoch advancement every 24h
  }
});

console.log("Group Created with ID: " + group.id + " at Epoch " + group.epoch);
\`\`\`

### Protocol Lifecycle
When you call this function, the ECHO client fetches the pre-published KeyPackages for Alice, Bob, and Charlie from the relay directory. It then acts as the "creator" of the group, constructing the initial Ratchet Tree, generating the first Group Secret, and securely distributing the Welcome message to all participants.

From this point on, any message sent to the group is encrypted exactly once using a symmetric key derived from the current Epoch's Group Secret, making group chat extremely fast even with thousands of participants.`,
  },
  "sdk-typescript": {
    title: "@echo/sdk for TypeScript",
    content: `The official TypeScript SDK provides a strict, type-safe interface for interacting with the core features of the ECHO decentralized communication engine.

TypeScript has revolutionized the way we write JavaScript by introducing static typing. Our SDK is written 100% in TypeScript, which means you get rich autocomplete, inline documentation, and compile-time error checking right in your IDE.

### Isomorphic Architecture
We designed the SDK to be isomorphic, meaning the exact same codebase works seamlessly in Node.js backend services, Deno runtimes, and modern frontend browsers. We achieve this by abstracting the cryptographic layer: in Node.js, we use native C++ bindings for maximum performance, while in the browser, we fall back to a highly optimized WebAssembly build of the same underlying Rust primitives.

\`\`\`typescript
import { Client, ClientConfiguration, MessagePayload } from '@echo/sdk';

const config: ClientConfiguration = {
  environment: 'production',
  storageBackend: 'indexeddb',
  relayNodes: ['https://relay.echo.io', 'https://backup-relay.echo.dev']
};

const client = new Client(config);
await client.connect();

// Listen for incoming asynchronous decrypted payloads
client.on('message', (message: MessagePayload) => {
  console.log("Received message from " + message.sender + ": " + message.body);
});
\`\`\`

The Client object is your main entry point. It handles lifecycle management, automatic reconnections, token refresh logic, and maintains the internal state machine required by the Double Ratchet protocol. We heavily utilize ES6 classes, async/await paradigms, and standard EventEmitters to make integration feel native and idiomatic for any JavaScript developer.`,
  },
  "sdk-rust": {
    title: "echo-rs (Rust crate)",
    content: `For high-performance applications, low-latency background services, or embedded devices, the **echo-rs** crate delivers absolute raw speed with compile-time safety.

Rust is the language of choice for systems programming when safety and speed are non-negotiable. At the heart of ECHO is a core cryptography library written entirely in Rust. This library is what powers all of our other SDKs across all platforms. By using the \`echo-rs\` crate directly, you bypass all FFI (Foreign Function Interface) overhead and interact directly with the metal.

### Async Performance via Tokio
The crate is designed around the popular \`tokio\` async runtime, making it highly concurrent and capable of handling millions of simultaneous connections with minimal memory footprint. We use zero-copy deserialization where possible and strictly enforce memory safety without relying on a garbage collector.

\`\`\`rust
use echo_rs::{Client, Config, Environment, Result};
use tokio;

#[tokio::main]
async fn main() -> Result<()> {
    // Build an optimized systems-level client configuration
    let config = Config::builder()
        .environment(Environment::Production)
        .database_path("./native_vault.db")
        .build()?;

    let client = Client::from_config(config).await?;
    client.connect().await?;

    let mut stream = client.subscribe_messages().await?;
    while let Some(msg) = stream.next().await {
        println!("Native Ciphertext Routed From: {}", msg.sender);
    }

    Ok(())
}
\`\`\`

Whether you are building a custom high-throughput relay, an embedded hardware wallet integration, or a command-line tool, the Rust SDK offers unparalleled performance.`,
  },
  "sdk-swift": {
    title: "echo-swift",
    content: `Build beautiful, native iOS, iPadOS, and macOS application experiences using **echo-swift**, which seamlessly maps the underlying systems architecture into Apple's Swift ecosystem.

When building for Apple platforms, native performance and smooth UI integration are essential. The \`echo-swift\` framework bridges the gap between Apple's modern Swift language and our robust Rust cryptography core.

### Native Concurrency & Security Enclave Integration
We use Apple's Swift concurrency model (async/await and Actors) to ensure that cryptographic operations never block the main thread. This means your UI stays buttery smooth even when deriving complex keys or processing large message payloads.

\`\`\`swift
import Echo
import Foundation

@MainActor
class ChatViewModel: ObservableObject {
    private let client: EchoClient
    @Published var connectionStatus = "Disconnected"
    
    init() {
        self.client = EchoClient(storage: .secureKeychain)
    }
    
    func initializeNetwork() async {
        do {
            try await client.connect()
            self.connectionStatus = "Connected securely to ECHO mesh network"
        } catch {
            self.connectionStatus = "Connection Failure: \\(error.localizedDescription)"
        }
    }
}
\`\`\`

The framework is distributed via Swift Package Manager (SPM) and is fully compatible with SwiftUI. It integrates seamlessly with Apple's secure enclave and Keychain for storing private keys, ensuring that your users' cryptographic identities are protected by the hardware-level security built into every iPhone and Mac.`,
  },
  "sdk-kotlin": {
    title: "echo-kotlin",
    content: `The **echo-kotlin** SDK brings enterprise-grade decentralized messaging mechanics to Android apps, prioritizing optimization for limited hardware profiles and mobile battery life.

Android development requires a careful balance between battery life, performance, and UI responsiveness. Our Kotlin SDK achieves this by leveraging Kotlin Coroutines and Flows to handle the complex asynchronous nature of real-time encrypted messaging.

### JNI Optimization & Hardware Backed Protection
Under the hood, \`echo-kotlin\` uses JNI (Java Native Interface) to call into our core Rust library. We've spent countless hours optimizing this bridge to eliminate garbage collection pauses and minimize memory allocations during encryption/decryption cycles.

\`\`\`kotlin
import io.echo.sdk.Client
import io.echo.sdk.internal.Dispatchers
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect

class AndroidCoreManager(private val client: Client) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun monitorInboundTraffic() {
        scope.launch {
            client.messageFlow().collect { incomingPacket ->
                withContext(Dispatchers.Main) {
                    // Update state safely on UI thread
                    renderIncomingUI(incomingPacket)
                }
            }
        }
    }
}
\`\`\`

The SDK is fully compatible with Jetpack Compose and modern Android architecture guidelines. It securely manages identity keys using the Android Keystore system, utilizing hardware-backed security modules (StrongBox or TEE) whenever available on the device.`,
  },
  "rest-relay": {
    title: "REST relay protocol",
    content: `ECHO clients communicate through a decentralized relay network via highly efficient, blind, state-isolated REST APIs.

In traditional messaging systems, a central server acts as a switchboard, reading and routing all messages. In the ECHO architecture, we use "relays". Relays are deliberately "dumb" and blind to the content they are routing.

### Metadata Blind Routing Design
When you send a message, it is fully encrypted on your device. The relay only sees an opaque blob of ciphertext and a routing identifier. It has no idea who you are talking to, what you are saying, or what files you are sending.

Below is the standard protocol blueprint for dispatching an encrypted payload chunk across the relay transport network:

\`\`\`http
POST /v1/messages/relay HTTP/1.1
Host: relay.echo.dev
Content-Type: application/json
Authorization: Bearer <anonymous-token>
X-Echo-Protocol-Version: 2.1

{
  "recipient_id": "8f3a2b99432e11ec94667f33221aa90f",
  "payload": "ey...encrypted_data...",
  "ttl": 86400
}
\`\`\`

The REST protocol is designed to be highly cacheable, stateless, and horizontally scalable. Relays do not require persistent database connections to route messages; they simply hold the encrypted blob in a fast in-memory store (like Redis) until the recipient comes online and downloads it. Once delivered, the message is permanently deleted from the relay.`,
  },
  "deploy-docker": {
    title: "Deploy a relay on Docker",
    content: `You can easily self-host an ECHO relay using our official Docker image. This gives you full sovereignty over your metadata.

Self-hosting is a core tenet of the ECHO philosophy. While we provide robust public relays, we believe that true privacy requires decentralization. By running your own relay, you ensure that not even ECHO developers can see the metadata of when you send messages or how much data you are transmitting.

### Production Docker Compose Architecture
Docker makes this process trivial. We publish verified, minimal, multi-architecture (amd64, arm64) images directly to Docker Hub and GitHub Container Registry.

Here is an enterprise-ready configuration featuring secure mounts, automated container lifecycles, and environment configuration:

\`\`\`yaml
version: '3.8'
services:
  echo-relay:
    image: echoprotocol/relay:latest
    restart: unless-stopped
    ports:
      - "443:8443"
    environment:
      - RELAY_DOMAIN=your-domain.com
      - LOG_LEVEL=info
      - MAX_PAYLOAD_SIZE=50MB
      - DB_BACKEND=sqlite
      - ENGINE_WORKERS=4
    volumes:
      - ./data:/app/data
      - ./certs:/app/certs
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
\`\`\`

This Docker Compose configuration spins up a fully functional relay. It expects valid TLS certificates in the /certs directory, as all ECHO communication strictly requires HTTPS/TLS 1.3. The /data volume persists the ephemeral message queue. Because the relay is written in Rust, it requires fewer than 50MB of RAM and virtually no CPU when idle, making it perfect for deploying on cheap VPS instances or a Raspberry Pi in your closet.`,
  },
  "federation": {
    title: "Federation with other nodes",
    content: `ECHO relays can federate with each other to route messages across different self-hosted environments.

Federation is what transforms isolated self-hosted relays into a massive, resilient global network. If Alice is registered on \`relay.alice.com\` and Bob is registered on \`node.bob.net\`, they can still communicate seamlessly.

When Alice sends a message to Bob, her client detects that Bob is on a different relay. It encrypts the payload and submits it to \`relay.alice.com\`. Alice's relay then acts as a proxy, establishing a secure server-to-server connection with \`node.bob.net\` and forwarding the encrypted blob.

### Configuration Specification
Federation topologies are defined via a deterministic root configuration scheme on the hosting node:

\`\`\`json
{
  "federation": {
    "enabled": true,
    "peers": ["relay2.example.com", "relay3.example.com"],
    "require_mutual_tls": true,
    "allowed_domains": ["*"],
    "rate_limits": {
      "max_requests_per_minute": 1200,
      "max_burst_payload_mb": 100
    }
  }
}
\`\`\`

This decentralized approach prevents vendor lock-in and eliminates single points of failure. The federation protocol utilizes mutual TLS (mTLS) for server-to-server authentication, ensuring that malicious nodes cannot spam or flood the network. You can configure your relay to be entirely public, or create a private, closed federation exclusively for your organization.`,
  },
  "backups": {
    title: "Backups & disaster recovery",
    content: `Relays store temporary encrypted message queues. While data loss doesn't affect long-term message history (handled by clients), maintaining uptime is crucial.

The ECHO architecture is designed so that the server holds almost no state. Long-term message history, contacts, and cryptographic keys live exclusively on the user's device. Therefore, a complete server crash does not result in a loss of conversation history.

However, relays do store messages that are currently in transit (i.e., the recipient is offline). If a relay goes down and its storage is wiped, any undelivered messages are permanently lost. To prevent this, proper backup strategies are essential.

### Automated Cloud Recovery Engine
Deploy the following cron-ready script to automate off-site backup states for relational metadata databases:

\`\`\`bash
#!/bin/bash
# High-Availability Backup script for postgres-backed relay
set -e

TIMESTAMP=$(date +"%F_%H%M%S")
BACKUP_DIR="/backups"
DB_NAME="echo_relay_db"
S3_BUCKET="s3://my-relay-backups/db-snapshots"

echo "Starting database dump sequence..."
pg_dump -F p -U postgres $DB_NAME > $BACKUP_DIR/echo_backup_$TIMESTAMP.sql

echo "Compressing historical payload tree..."
gzip $BACKUP_DIR/echo_backup_$TIMESTAMP.sql

echo "Syncing encrypted assets to remote S3 cold vault..."
aws s3 cp $BACKUP_DIR/echo_backup_$TIMESTAMP.sql.gz $S3_BUCKET/echo_backup_$TIMESTAMP.sql.gz

echo "Backup transaction completely successfully."
\`\`\`

We recommend implementing continuous snapshotting for your Redis message queues and nightly backups for any persistent Postgres metadata stores (which hold public identity keys and routing tables). Disaster recovery should be practiced regularly; you should be able to spin up a new instance of your relay from a backup in under 5 minutes.`,
  },
  "observability": {
    title: "Observability (Prometheus / OTLP)",
    content: `Monitor your ECHO relay using built-in Prometheus metrics and OpenTelemetry traces.

Running a reliable service requires deep visibility into its performance and health. We have instrumented the ECHO relay with comprehensive OpenTelemetry (OTLP) tracing and Prometheus metrics right out of the box.

You can track everything from the P99 latency of message delivery and the total number of connected WebSockets, to the memory consumption of the async runtime and the disk I/O of the storage backend.

### Target Scraping Metrics
Configure your external global monitoring server to ingest incoming data from the relay endpoint using this standard scaffolding format:

\`\`\`yaml
scrape_configs:
  - job_name: 'echo_relay_cluster'
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics'
    static_configs:
      - targets: ['relay-node-01.local:9090', 'relay-node-02.local:9090']
        labels:
          environment: 'production-mesh'
          region: 'eu-west-1'
\`\`\`

By pointing a Prometheus instance at your relay's metrics endpoint, you can easily build beautiful Grafana dashboards. We even provide pre-built Grafana JSON templates in our repository to get you started immediately. Monitoring is especially critical if you enable federation, as you'll want to track bandwidth usage and latency between peered nodes to ensure optimal routing.`,
  },
  "key-derivation": {
    title: "Key derivation (Argon2id)",
    content: `ECHO uses Argon2id for key derivation, protecting against both GPU cracking and side-channel attacks.

When a user creates an account or unlocks their application, their master encryption key must be derived from a password or a biometric hardware token. This derivation process is the most vulnerable point for offline dictionary attacks. If an attacker steals the encrypted database from a phone, they can attempt to guess the password millions of times per second using specialized GPU clusters.

### Argon2id Parametric Tuning
To combat this, we use Argon2id, the winner of the Password Hashing Competition. Argon2id is specifically designed to be highly resistant to both GPU/ASIC cracking (by requiring large amounts of memory) and side-channel attacks (by making memory access patterns independent of the password).

\`\`\`javascript
// Argon2id parameters strictly enforced in ECHO
const params = {
  memoryCost: 65536, // 64 MB of RAM required per derivation
  timeCost: 4,       // Number of iterations
  parallelism: 2,    // Number of threads
  hashLength: 32     // 256-bit output key
};
\`\`\`

These parameters are carefully tuned. They ensure that deriving the key takes roughly 500 milliseconds on a modern smartphone. While half a second is barely noticeable to a human user logging in, it poses an insurmountable, incredibly expensive barrier to an attacker trying to brute-force a password database.`,
  },
  "double-ratchet": {
    title: "Double Ratchet specification",
    content: `We implement the Double Ratchet Algorithm for perfect forward secrecy and break-in recovery.

The Double Ratchet is the gold standard for secure asynchronous messaging. It was originally developed by Trevor Perrin and Moxie Marlinspike and has since become the foundation for almost every modern secure messenger.

### The Symmetric and Asymmetric Engine
The genius of the Double Ratchet lies in its two concurrent processes:
1. **The KDF Ratchet (Symmetric):** Every time a message is sent, the symmetric key is passed through a Key Derivation Function (KDF) to generate a new key for the next message, and the old key is immediately deleted. This guarantees **Forward Secrecy (FS)**—if an attacker steals your device today, they cannot decrypt messages you sent yesterday.
2. **The DH Ratchet (Asymmetric):** Periodically, the client performs a new Diffie-Hellman key exchange by attaching new public keys to outgoing messages. When the recipient replies, a new shared secret is established, which seeds the KDF ratchet. This guarantees **Post-Compromise Security (PCS)** or "Break-in Recovery"—if an attacker steals your key today, they will lose access the moment you and your contact exchange a new DH ratchet message.

By combining these two ratchets, ECHO ensures that even a catastrophic compromise of a device only exposes a tiny fraction of the conversation timeline. The mathematical complexity behind this is managed entirely by our SDK, making it completely invisible and frictionless for the end user.`,
  },
  "mls-group-epochs": {
    title: "MLS group epochs",
    content: `For group messaging, ECHO implements the IETF Messaging Layer Security (MLS) standard.

Historically, adding a new member to an encrypted group chat meant generating a new key and sending it individually to every existing member. For a group of 100 people, this meant 100 separate encryption operations just to add one person. This approach simply does not scale.

### Asymptotic Scaling via Tree-KEM
MLS changes the game entirely. It uses a binary tree (a Ratchet Tree) where each leaf node is a user, and intermediate nodes contain intermediate keys. The root of the tree contains the Group Secret. When a user joins or leaves, they only need to update their path to the root, which requires O(log N) operations instead of O(N).

Whenever the group composition changes, or just periodically for security, the group advances to a new **Epoch**. An Epoch represents a specific state of the group with a specific Group Secret.

This Epoch-based approach provides incredible security guarantees. When someone is removed from a group and the Epoch advances, it is cryptographically impossible for them to read any future messages (Forward Secrecy). Conversely, when someone joins a group, they cannot read any messages from previous Epochs (Backward Secrecy). ECHO's implementation of MLS brings enterprise-grade scalability to end-to-end encrypted groups.`,
  },
  "hybrid-pq": {
    title: "Hybrid PQ handshake (Kyber + X25519)",
    content: `To protect against future quantum computers (Store Now, Decrypt Later attacks), ECHO utilizes a hybrid post-quantum handshake.

The cryptographic community is facing an impending threat: sufficiently powerful quantum computers running Shor's algorithm will be able to easily break standard public-key cryptography, including the elliptic curves (like X25519) we rely on today.

### Quantum-Safe Defense Paradigm
While quantum computers of this scale do not yet exist, state-sponsored attackers are currently executing "Store Now, Decrypt Later" (SNDL) attacks. They are vacuuming up vast amounts of encrypted traffic today, hoarding it in massive data centers, waiting for the day a quantum computer is built to decrypt it all.

To defend against this, ECHO has proactively implemented a **Hybrid Post-Quantum Architecture**.

\`\`\`javascript
// The shared secret is derived from both algorithms
const sharedSecret = hkdf(
  concat(x25519_secret, kyber_secret)
);
\`\`\`

When establishing a connection, ECHO performs two independent key exchanges simultaneously:
1. The classic, battle-tested X25519 Elliptic Curve Diffie-Hellman.
2. ML-KEM (formerly known as CRYSTALS-Kyber), the NIST-standardized Post-Quantum Key Encapsulation Mechanism.

The two resulting secrets are concatenated and passed through an HMAC-based Key Derivation Function (HKDF). This hybrid approach is the ultimate safety net. If a vulnerability is found in the new, relatively untested ML-KEM algorithm, the encryption falls back to the proven security of X25519. But if a quantum computer breaks X25519, the encryption remains secure because the quantum computer cannot break ML-KEM. We guarantee your privacy not just today, but for decades into the future.`,
  },
};

export default function DocsPage() {
  const [q, setQ] = useState("");
  const [currentSection, setCurrentSection] = useState("install-echo");
  const [copiedCode, setCopiedCode] = useState(null);

  const currentContent = contentMap[currentSection];

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderContent = (content) => {
    if (!content) return null;

    // Split by code blocks - using a simpler approach
    const codeBlockRegex = /```[\s\S]*?```/g;
    const parts = content.split(codeBlockRegex);
    const codeBlocks = content.match(codeBlockRegex) || [];

    return parts.map((part, index) => {
      // Render code block if it exists for this index
      const codeBlock = codeBlocks[index - 1];

      const elements = [];

      // Add text content
      if (part) {
        const subBlocks = part.split("\n");
        elements.push(
          <div key={`text-${index}`} className="space-y-4">
            {subBlocks.map((block, bIdx) => {
              if (block.startsWith("### ")) {
                return (
                  <h3 key={bIdx} className="text-xl font-bold text-white mt-6 mb-2 tracking-tight">
                    {block.replace("### ", "")}
                  </h3>
                );
              }
              if (block.trim() === "") return null;

              const textParts = block.split(/(\*\*.*?\*\*)/g);
              return (
                <p key={bIdx} className="text-[#cfcfdc] leading-relaxed text-base whitespace-pre-wrap">
                  {textParts.map((t, i) => {
                    if (t.startsWith("**") && t.endsWith("**")) {
                      return (
                        <strong key={i} className="text-white font-semibold">
                          {t.slice(2, -2)}
                        </strong>
                      );
                    }
                    return t;
                  })}
                </p>
              );
            })}
          </div>
        );
      }

      // Add code block if it exists
      if (codeBlock) {
        // Extract language and code without using problematic regex
        const lines = codeBlock.split('\n');
        const firstLine = lines[0];
        const language = firstLine.replace('```', '').trim() || 'text';
        const code = lines.slice(1, -1).join('\n');

        elements.push(
          <div key={`code-${index}`} className="relative my-6 group">
            <div className="bg-black/50 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.03]">
                <span className="text-xs text-[#a855f7] uppercase tracking-wider font-semibold">
                  {language}
                </span>
                <button
                  onClick={() => handleCopy(code)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#a0a0a0] hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  {copiedCode === code ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <pre className="text-sm font-mono text-zinc-300 leading-relaxed p-6 overflow-x-auto">
                {code}
              </pre>
            </div>
          </div>
        );
      }

      return elements;
    }).flat();
  };

  const allSubsections = SECTIONS.flatMap((s) => s.subsections);

  let filteredSections = SECTIONS;
  if (q.trim()) {
    const query = q.toLowerCase();
    filteredSections = SECTIONS.map((section) => ({
      ...section,
      subsections: section.subsections.filter(
        (sub) =>
          sub.title.toLowerCase().includes(query) ||
          (contentMap[sub.id] && contentMap[sub.id].content.toLowerCase().includes(query))
      ),
    })).filter((section) => section.subsections.length > 0);
  }

  const currentIndex = allSubsections.findIndex((s) => s.id === currentSection);
  const prevSection = currentIndex > 0 ? allSubsections[currentIndex - 1] : null;
  const nextSection =
    currentIndex < allSubsections.length - 1 ? allSubsections[currentIndex + 1] : null;

  return (
    <PageShell
      eyebrow="Resources · Documentation"
      icon={BookOpen}
      title={
        <>
          Everything you need to{" "}
          <span className="echo-gradient-text">build, deploy, audit.</span>
        </>
      }
      subtitle="Concepts, recipes, full protocol reference. Search 240+ pages."
    >
      <div className="flex flex-col lg:flex-row gap-8 mt-10">
        {/* Sidebar */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="glass cyber-border rounded-2xl p-6 lg:sticky lg:top-24">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a0a0]" />
              <input
                type="text"
                placeholder="Search docs..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-[#6f6f7e] focus:outline-none focus:border-[#a855f7]/55 text-sm transition-all"
              />
            </div>

            {/* Sections */}
            <nav className="space-y-6">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                        <Icon className="h-3 w-3 text-white" />
                      </span>
                      <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                    </div>
                    <div className="space-y-1 pl-8 border-l border-white/5 ml-3">
                      {section.subsections.map((sub) => {
                        const isActive = currentSection === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setCurrentSection(sub.id);
                              const mainContent = document.getElementById("docs-main-content");
                              if (mainContent) {
                                mainContent.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }
                            }}
                            className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${isActive
                              ? "bg-[#a855f7]/10 text-[#c4a8ff] font-medium border border-[#a855f7]/20"
                              : "text-[#b9b9c4] hover:text-white hover:bg-white/5"
                              }`}
                          >
                            {sub.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {filteredSections.length === 0 && (
                <div className="text-sm text-[#b9b9c4] text-center py-4">
                  No results found for &quot;{q}&quot;
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main id="docs-main-content" className="flex-1 min-h-[500px] scroll-mt-24">
          <div className="glass cyber-border rounded-2xl p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">
                  {currentContent?.title}
                </h1>
                <div className="prose prose-invert max-w-none text-base">
                  {renderContent(currentContent?.content)}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-16 pt-8 border-t border-white/10">
              {prevSection ? (
                <button
                  onClick={() => {
                    setCurrentSection(prevSection.id);
                    const mainContent = document.getElementById("docs-main-content");
                    if (mainContent) {
                      mainContent.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="group flex flex-col items-start text-[#b9b9c4] hover:text-white transition-colors"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Previous
                  </span>
                  <span className="text-sm">{prevSection.title}</span>
                </button>
              ) : (
                <div />
              )}

              {nextSection ? (
                <button
                  onClick={() => {
                    setCurrentSection(nextSection.id);
                    const mainContent = document.getElementById("docs-main-content");
                    if (mainContent) {
                      mainContent.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="group flex flex-col items-end text-[#b9b9c4] hover:text-white transition-colors"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                    Next
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="text-sm">{nextSection.title}</span>
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </main>
      </div>
    </PageShell>
  );
}