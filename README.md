<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/echo-logo-text.png" width="300">
    <img src="public/echo-logo-text.png" alt="Echo  Encrypted Messaging" width="300">
  </picture>
</h1>

<p align="center">
  <strong>Military-grade end-to-end encrypted messaging. No backdoors. No exceptions.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Built_with-Rust-orange.svg" alt="Rust"></a>
  <a href="https://webassembly.org/"><img src="https://img.shields.io/badge/Powered_by-WebAssembly-purple.svg" alt="WebAssembly"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18"></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5"></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white" alt="Tauri"></a>
</p>

---

## What is Echo?

Echo is an open-source, end-to-end encrypted messaging app built on a custom security protocol inspired by the [Signal Protocol](https://signal.org/docs/). Every cryptographic operation **X3DH key exchange**, **XEdDSA signing**, and **AES-256 encryption** is powered by native Rust modules compiled to WebAssembly, running entirely client-side with zero server-side key access.

Available as a **web app** and a **native desktop app** (via Tauri).

> Developed by **Marcos Cabrero**, **Gonzalo de la Lastra**, **Miguel Mascaró** and **Nicolás Pertierra**

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Building WASM Modules](#building-wasm-modules)
  - [Running](#running)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
  - [Commit Convention](#commit-convention)
  - [Releasing](#releasing)
- [Security Protocol](#security-protocol)
  - [AEAD AES-256 (Authenticated Encryption with Associated Data)](#aead-aes-256-authenticated-encryption-with-associated-data)
  - [X3DH (Extended Triple Diffie-Hellman)](#x3dh-extended-triple-diffie-hellman)
  - [XEdDSA (EdDSA for X25519)](#xeddsa-eddsa-for-x25519)
  - [XEdDSA Signing](#xeddsa-signing)
  - [XEdDSA Verification](#xeddsa-verification)
  - [Double Ratchet Algorithm](#double-ratchet-algorithm)
- [References](#references)

---

## Tech Stack

| Layer         | Technology                                |
| ------------- | ----------------------------------------- |
| UI Framework  | React 18 + Vite 5                         |
| Styling       | Tailwind CSS 3 + Framer Motion            |
| Routing       | React Router 7                            |
| Real-time     | Socket.io-client 4                        |
| Crypto (WASM) | Rust `aes-wasm`, `dh-wasm`, `xeddsa-wasm` |
| Desktop       | Tauri 2                                   |
| i18n          | i18next (EN, ES, FR, DE, ZH)              |
| State         | React Context (AuthContext)               |

---

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Rust](https://rustup.rs/) (for building WASM modules and the desktop app)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)

```bash
cargo install wasm-pack
```

### Installation

```bash
# Clone the repo
git clone https://github.com/echo-chat-protocol/echo-frontend.git
cd echo-frontend

# Install dependencies
npm install
```

### Building WASM Modules

Each Rust module must be compiled to WASM before running the app:

```bash
# AES-256 encryption
cd aes-wasm && wasm-pack build --target web && cd ..

# X25519 / Diffie-Hellman
cd dh-wasm && wasm-pack build --target web && cd ..

# XEdDSA signatures
cd xeddsa-wasm && wasm-pack build --target web && cd ..
```

### Running

```bash
# Web (development)
npm run dev

# Web (production build)
npm run build
npm run preview

# Desktop app (Tauri)
npm run tauri dev
```

---

## Environment Variables

Copy `.env.development` and fill in your values:

```bash
cp .env.development .env.local
```

| Variable          | Description               |
| ----------------- | ------------------------- |
| `VITE_API_URL`    | Backend REST API base URL |
| `VITE_SOCKET_URL` | Socket.io server URL      |

---

## Project Structure

```
echo-frontend/
 src/
    components/
       auth/               # Login, Register, PrivateRoute
       common/             # ErrorBoundary, Spinner, Toast
       Dashboard/          # Main chat UI
       HomepageComponents/ # Navbar, Footer, Blog
       landing/            # Hero, Features, Pricing
    hooks/                  # useAuth, useSocket, useConversations
    services/               # socket.js, api.js
    store/                  # AuthContext
    pages/                  # Top-level route pages
    i18n/                   # Translations (EN ES FR DE ZH)
 aes-wasm/                   # Rust AES-256 WASM module
 dh-wasm/                    # Rust X25519 DH WASM module
 xeddsa-wasm/                # Rust XEdDSA WASM module
 src-tauri/                  # Tauri desktop configuration
 public/                     # Static assets
```

---

## Contributing

### Commit Convention

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Husky enforces this automatically on every commit.

```
<type>(optional scope): <short description>
```

| Type       | When to use                          | Appears in CHANGELOG  |
| ---------- | ------------------------------------ | --------------------- |
| `feat`     | New feature                          | Yes — bumps **minor** |
| `fix`      | Bug fix                              | Yes — bumps **patch** |
| `perf`     | Performance improvement              | Yes — bumps **patch** |
| `revert`   | Revert a previous commit             | Yes — bumps **patch** |
| `docs`     | Documentation only                   | No                    |
| `style`    | Formatting, whitespace               | No                    |
| `refactor` | Code restructure, no behavior change | No                    |
| `test`     | Adding or fixing tests               | No                    |
| `chore`    | Build process, tooling, deps         | No                    |
| `ci`       | CI/CD configuration                  | No                    |

**Breaking changes** — add `BREAKING CHANGE:` in the commit body or append `!` after the type. This bumps the **major** version.

```bash
# Examples
git commit -m "feat: add group chat encryption"
git commit -m "fix: token refresh race condition"
git commit -m "feat!: replace REST with WebSocket API"
# or with body:
git commit -m "feat: new auth flow" -m "BREAKING CHANGE: removes /api/v1/login endpoint"
```

> Commits that don't follow the convention will be **rejected by Husky** before they are recorded.

### Releasing

Once your changes are committed, generate a new version and update the changelog in one command:

```bash
# Auto-detects bump type from commit history (patch / minor / major)
npm run release

# Or force a specific bump
npm run release:patch
npm run release:minor
npm run release:major
```

This will:

1. Bump the `version` in `package.json`
2. Update `CHANGELOG.md` with all commits since the last release grouped by type
3. Create a git commit and tag (`vX.Y.Z`) automatically

Then push the commit and tag:

```bash
git push --follow-tags
```

---

## Security Protocol

<h1 align="center">
    <img src="EchoProtocolLogo.png" width="400" alt="Echo Protocol Logo">
</h1>

The cryptographic primitives are built in Rust and compiled into javascript using WASM. [Echo-Protocol](https://github.com/Pringles505/Echo-Protocol) can be installed using:

``` npm install @mascaro101/echo-protocol ```

## **AEAD AES-256 (Authenticated Encryption with Associated Data)**

AEAD AES‑256 provides **confidentiality, integrity, and authenticity**
for encrypted messages.

Later we will use AEAD AES-256 alongside the Double Ratchet algorithm to
encrypt each message using a **unique message key (`MK`)** derived from
the ratchet chain.

## **Core Components**
  `AES‑256`                      Symmetric block cipher using a 256‑bit key
  `Nonce`                        Unique value used once per encryption operation
  `Ciphertext`                   Encrypted output of the plaintext
  `Authentication Tag`           Integrity check generated during encryption
  `AAD`                          Associated data authenticated but not encrypted (e.g., message headers)

## **Encryption Process**

-   `MK`  message key (256‑bit)
-   `Nonce`   unique 96‑bit value
-   `Plaintext`   message content
-   `AAD`   optional associated data

Encryption is performed as:

    ciphertext, tag = AES256_GCM_Encrypt(MK, Nonce, plaintext, AAD)

The result consists of:

    message = {
        nonce,
        ciphertext,
        tag
    }

The `AAD` is not encrypted but is included in the authentication
calculation.

## **Decryption Process**

Upon receiving a message:

    plaintext = AES256_GCM_Decrypt(MK, Nonce, ciphertext, tag, AAD)

If authentication fails:

-   the message is **rejected**
-   no plaintext is returned

This ensures that any tampering with the ciphertext or associated data
is detected.

## **Nonce Requirements**

A nonce **must never be reused with the same key**.

Typical construction:

    Nonce = message_counter || random_bytes

In ratcheted messaging systems, the nonce can be derived from the
**message number (`n`)** to guarantee uniqueness.

## **X3DH (Extended Triple Diffie-Hellman)**

X3DH is a key agreement protocol used to establish a shared secret between two parties (e.g., Alice and Bob) using public-key cryptography. It ensures **forward secrecy** and **deniability**.

### **Key Exchange Process**

1. **Public Key Components**:
   - Each user has:
     - **Identity Key (IK)**: Long-term key pair for authentication.
     - **Signed Prekey (SPK)**: Short-term key signed by `IK`, rotated periodically.
     - **One-Time Prekeys (OPK)**: Optional single-use keys for forward secrecy.

2. **Key Exchange Steps**:
   - Alice fetches Bob's prekeys (`IK_B`, `SPK_B`, `OPK_B`).
   - Alice verifies `SPK_B`'s signature using `IK_B` (via **XEdDSA**).
   - Alice performs **four DH operations**:
     ```python
     DH1 = DH(IK_A, SPK_B)   # Alice-Identity and Bob-SignedPreKey
     DH2 = DH(EK_A, IK_B)    # Alice-Ephemeral and Bob-Identity
     DH3 = DH(EK_A, SPK_B)   # Alice-Ephemeral and Bob-SignedPreKey
     DH4 = DH(EK_A, OPK_B)   # Alice-Ephemeral and Bob-OneTimeKey
     ```
   - The shared secret is derived as:
     ```python
     SK = KDF(DH1 || DH2 || DH3 || DH4)
     ```

---

## **XEdDSA (EdDSA for X25519)**

XEdDSA is a signature scheme based on the Edwards-curve Digital Signature Algorithm (EdDSA). EdDSA is designed for Twisted-Edwards curves, however since we use X25519 (Montgomery form) for Diffie-Hellman operations, keys must be converted to Edwards form before signing. This pre-conversion is the key distinction of XEdDSA.

### **How It Works**

#### Prerequisites

`Encoding` For storing points, usually 64 bytes (32 for X, 32 for Y). We compress by dropping X and storing a sign bit; X is recalculated on decode.

`SHA-512` Hashing algorithm producing a 512-bit digest from any input.

`Scalar Multiplication` Repeated addition of a point on the curve to itself; the keystone operation in ECC.

`Clamping` Byte-level adjustment of keys to prevent subgroup attacks.

| Byte Index | Description       | Operation                    | Purpose                                       |
| ---------- | ----------------- | ---------------------------- | --------------------------------------------- |
| 0          | Least significant | `a[0] &= 248`                | Clears bits 0-2; makes scalar a multiple of 8 |
| 130        | Middle bytes      |                              | Retains entropy                               |
| 31         | Most significant  | `a[31] &= 127; a[31] \|= 64` | Keeps scalar in [2, 2)                        |

#### Key Terminology

| Term      | Description                                                | Curve Form         |
| --------- | ---------------------------------------------------------- | ------------------ |
| `xprivIK` | X25519 private key (32-byte scalar)                        | Montgomery         |
| `xpubIK`  | X25519 public key (derived from `xprivIK`)                 | Montgomery         |
| `xpubPK`  | X25519 public pre-key                                      | Montgomery         |
| `a`       | Clamped Edwards private scalar (from `xprivIK`)            | Edwards            |
| `Prefix`  | Generated alongside `a` from SHA-512 of `xprivIK`          |                    |
| `A`       | Edwards public key (derived from `a`)                      | Edwards            |
| `r`       | Deterministic nonce                                        |                    |
| `R`       | Nonce point (`R = r * B`)                                  | Edwards            |
| `k`       | Challenge hash (`k = H(R  A  M) mod L`)                    |                    |
| `S`       | Signature scalar (`S = (r + k * a) mod L`)                 |                    |
| `L`       | Curve order (`2 + 27742317777372353535851937790883648493`) |                    |
| `B`       | Basepoint (curve generator)                                | Edwards/Montgomery |

### XEdDSA Signing

1. **Initial Key Conversion** Run `xprivIK` through SHA-512. First 32 bytes clamped scalar `a`. Last 32 bytes `Prefix`.

2. **Compute Deterministic Nonce**

   $$r = \text{SHA}(\text{Prefix} \mathbin{\|} \text{message}) \bmod L$$

   Pass `xpubPK` as the message to sign the PreKey.

3. **Compute Nonce Point**

   $$R = B \cdot r$$

   Encode `R` to 32 bytes (Y coordinate + sign bit of X).

4. **Recompute Public Key in Edwards Form** Repeat SHA-512 on `xprivIK`, clamp first 32 bytes, then `A = B * a`. Encode to 32 bytes.

5. **Compute Challenge Hash**

   $$k = \text{SHA}(R \mathbin{\|} A \mathbin{\|} \text{message}) \bmod L$$

6. **Compute Signature Scalar**

   $$S = (r + k \cdot a) \bmod L$$

7. **Final Signature**

   $$\text{Signature} = R \mathbin{\|} S$$

### XEdDSA Verification

1. **Decompress Inputs** Extract `R` and `S` from the signature. Convert received public key to Edwards form.

2. **Compute Challenge Hash**

   $$k = \text{SHA}(R \mathbin{\|} A \mathbin{\|} \text{message}) \bmod L$$

3. **Verify**

   $$S \cdot B \stackrel{?}{=} R + k \cdot A$$

   If the equation holds, the signature is valid.

   The signature is then compared with the given signature. In the case it matches it's authorized.

---

## **Double Ratchet Algorithm**

The Double Ratchet Algorithm is a **stateful key evolution protocol**
used to provide secure messaging after an initial shared secret has been
established (through **X3DH**). It ensures:

-   **Forward Secrecy** -- past messages remain secure if current keys
    are compromised.
-   **Post-Compromise Security** -- security can recover after a
    compromise once a new Diffie-Hellman exchange occurs.
-   **Message Confidentiality and Integrity** through continuously
    evolving keys.

------------------------------------------------------------------------

### **Ratchet State**

Each participant maintains a ratchet state containing:

  Variable   Description
  ---------- --------------------------------------------------------
  `RK`       Root Key -- master key used to derive chain keys
  `CKs`      Sending Chain Key
  `CKr`      Receiving Chain Key
  `DHs`      Local Diffie-Hellman key pair
  `DHr`      Remote Diffie-Hellman public key
  `Ns`       Number of messages sent in current sending chain
  `Nr`       Number of messages received in current receiving chain
  `PN`       Number of messages in the previous sending chain

------------------------------------------------------------------------

## **Key Derivation**

All key updates rely on a **Key Derivation Function (KDF)**.

Two KDF chains are used:

### **Root Key Derivation**

When a new Diffie-Hellman exchange occurs:

    RK, CK = KDF_RK(RK, DH(DHs, DHr))

Where:

-   `RK` becomes the updated root key
-   `CK` becomes a new chain key

------------------------------------------------------------------------

### **Message Key Derivation**

For every message sent or received:

    CK, MK = KDF_CK(CK)

Where:

-   `CK` becomes the next chain key
-   `MK` is the message encryption key

------------------------------------------------------------------------

## **Algorithm Workflow**

### **1. Initial State**

After **X3DH** establishes the initial shared secret:

    RK = SK
    DHs = generate_DH_keypair()
    DHr = received_DH_key
    CKs = CKr = null
    Ns = 0
    Nr = 0
    PN = 0

The first sending chain is derived:

    RK, CKs = KDF_RK(RK, DH(DHs, DHr))

------------------------------------------------------------------------

## **Sending a Message**

When Alice sends a message:

### **1. Derive Message Key**

    CKs, MK = KDF_CK(CKs)

### **2. Encrypt Message**

    ciphertext = AEAD_Encrypt(MK, plaintext)

### **3. Construct Header**

The message header contains:

    header = {
        dh: DHs_public,
        pn: PN,
        n: Ns
    }

### **4. Update Counter**

    Ns += 1

------------------------------------------------------------------------

## **Receiving a Message**

When Bob receives a message:

### **1. Check for New DH Key**

If the received `dh` differs from `DHr`, perform a **DH Ratchet Step**.

------------------------------------------------------------------------

## **Diffie-Hellman Ratchet Step**

When a new public key appears:

### **1. Update Counters**

    PN = Ns
    Ns = 0
    Nr = 0

### **2. Update Receiving Chain**

    DHr = received_dh
    RK, CKr = KDF_RK(RK, DH(DHs, DHr))

### **3. Generate New DH Key Pair**

    DHs = generate_DH_keypair()

### **4. Update Sending Chain**

    RK, CKs = KDF_RK(RK, DH(DHs, DHr))

This step **re-establishes cryptographic freshness**.

------------------------------------------------------------------------

## **Decrypting Messages**

Once the correct receiving chain key is established:

### **1. Derive Message Key**

    CKr, MK = KDF_CK(CKr)

### **2. Decrypt**

    plaintext = AEAD_Decrypt(MK, ciphertext)

### **3. Update Counter**

    Nr += 1

------------------------------------------------------------------------

## **Handling Out-of-Order Messages**

Messages may arrive out of order due to network conditions.

To handle this, the algorithm stores **skipped message keys**:

    MKSKIPPED[(dh, n)] = MK

If a delayed message arrives later, the stored key can decrypt it
without breaking the ratchet state.

------------------------------------------------------------------------

## References

- [Signal XEdDSA Specification](https://signal.org/docs/specifications/xeddsa/)
- [RFC 8032 Edwards-Curve Digital Signature Algorithm (EdDSA)](https://datatracker.ietf.org/doc/html/rfc8032)
- [RFC 7748 Elliptic Curves for Security (Curve25519)](https://datatracker.ietf.org/doc/html/rfc7748)
- [The Signal Protocol](https://signal.org/docs/)
