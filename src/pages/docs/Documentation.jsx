import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, Link } from 'react-router-dom'
import {
  ChevronRight,
  Search,
  Menu,
  X,
  Copy,
  Check,
  Play,
  RotateCcw,
  Wifi,
  Database,
  Lock,
  Send,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/HomepageComponents/Navbar'

const ApiPlayground = () => {
  const [method, setMethod] = useState('GET')
  const [endpoint, setEndpoint] = useState('/v1/conversations')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [activeTab, setActiveTab] = useState('params')

  const endpoints = [
    { method: 'GET', path: '/v1/conversations', label: 'List Conversations' },
    { method: 'POST', path: '/v1/conversations', label: 'Create Conversation' },
    { method: 'GET', path: '/v1/messages', label: 'List Messages' },
    { method: 'POST', path: '/v1/messages', label: 'Send Message' },
    { method: 'GET', path: '/v1/users/me', label: 'Get Current User' },
  ]

  const handleSend = () => {
    setIsLoading(true)
    setResponse(null)

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      if (endpoint.includes('conversations') && method === 'GET') {
        setResponse({
          status: 200,
          data: {
            conversations: [
              {
                id: 'conv_123',
                participants: ['alice@echo.dev', 'bob@echo.dev'],
                last_message: 'Hello there!',
                updated_at: '2024-03-10T10:00:00Z',
              },
              {
                id: 'conv_456',
                participants: ['charlie@echo.dev'],
                last_message: 'Meeting at 5?',
                updated_at: '2024-03-09T15:30:00Z',
              },
            ],
            meta: { page: 1, total: 2 },
          },
        })
      } else if (method === 'POST') {
        setResponse({
          status: 201,
          data: {
            id: 'msg_789',
            conversation_id: 'conv_123',
            status: 'encrypted',
            timestamp: new Date().toISOString(),
          },
        })
      } else {
        setResponse({
          status: 200,
          data: {
            id: 'usr_999',
            email: 'developer@echo.dev',
            public_key: 'dh_x25519_...',
          },
        })
      }
    }, 800)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className='space-y-8'
    >
      <div>
        <h1 className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'>
          API Playground
        </h1>
        <p className='text-zinc-400 text-lg'>
          Test Echo's endpoints directly from your browser. No API key required for this demo
          environment.
        </p>
      </div>

      <div className='bg-black/50 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm'>
        {/* Request Bar */}
        <div className='p-4 border-b border-white/10 flex flex-col md:flex-row gap-4'>
          <div className='flex-1 flex gap-0 rounded-lg overflow-hidden border border-white/10'>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className='bg-white/5 text-white px-4 py-2.5 border-r border-white/10 focus:outline-none font-mono text-sm font-bold'
              style={{
                color: method === 'GET' ? '#60a5fa' : method === 'POST' ? '#4ade80' : '#f472b6',
              }}
            >
              <option value='GET'>GET</option>
              <option value='POST'>POST</option>
              <option value='PUT'>PUT</option>
              <option value='DELETE'>DELETE</option>
            </select>
            <input
              type='text'
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className='flex-1 bg-transparent text-zinc-300 px-4 py-2.5 focus:outline-none font-mono text-sm'
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading}
            className='bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isLoading ? (
              <RotateCcw className='animate-spin w-4 h-4' />
            ) : (
              <Play className='w-4 h-4 fill-current' />
            )}
            <span>Send Request</span>
          </button>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 min-h-[500px]'>
          {/* Sidebar / Presets */}
          <div className='border-r border-white/10 bg-white/5 p-4 hidden lg:block'>
            <h3 className='text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4'>
              Available Endpoints
            </h3>
            <div className='space-y-2'>
              {endpoints.map((ep) => (
                <button
                  key={ep.label}
                  onClick={() => {
                    setMethod(ep.method)
                    setEndpoint(ep.path)
                    setResponse(null)
                  }}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                    endpoint === ep.path && method === ep.method
                      ? 'bg-violet-600/10 border-violet-500/30 text-white'
                      : 'bg-transparent border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        ep.method === 'GET'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className='font-mono text-xs opacity-70'>{ep.path}</span>
                  </div>
                  <div className='font-medium'>{ep.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Area */}
          <div className='lg:col-span-2 flex flex-col'>
            {/* Tabs */}
            <div className='flex border-b border-white/10'>
              {['params', 'headers', 'body'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-violet-500 text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className='p-4 flex-1 bg-black/20'>
              {activeTab === 'body' ? (
                <textarea
                  className='w-full h-full bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none'
                  placeholder="{ 'key': 'value' }"
                  defaultValue={
                    method === 'POST'
                      ? '{\n  "text": "Hello World",\n  "recipient": "bob@echo.dev"\n}'
                      : ''
                  }
                />
              ) : (
                <div className='text-zinc-500 text-sm italic p-4 text-center'>
                  No {activeTab} required for this request.
                </div>
              )}
            </div>

            {/* Response Area */}
            <div className='border-t border-white/10 bg-black/40 flex flex-col h-1/2'>
              <div className='px-4 py-2 border-b border-white/10 flex justify-between items-center bg-white/5'>
                <span className='text-xs font-bold text-zinc-400 uppercase'>Response</span>
                {response && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      response.status < 300
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    Status: {response.status}
                  </span>
                )}
              </div>
              <div className='p-4 overflow-auto flex-1'>
                {isLoading ? (
                  <div className='flex items-center justify-center h-full text-zinc-500 gap-2'>
                    <RotateCcw className='animate-spin w-4 h-4' />
                    <span className='text-sm'>Processing request...</span>
                  </div>
                ) : response ? (
                  <pre className='text-sm font-mono text-green-400'>
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                ) : (
                  <div className='text-zinc-600 text-sm font-mono'>
                    // Click "Send Request" to see the response
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const Documentation = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentSection, setCurrentSection] = useState('intro')
  const [copiedCode, setCopiedCode] = useState(null)

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      subsections: [
        { id: 'intro', title: 'Introduction' },
        { id: 'installation', title: 'Installation' },
        { id: 'quickstart', title: 'Quick Start' },
      ],
    },
    {
      id: 'playground',
      title: 'API Playground',
      subsections: [{ id: 'interactive', title: 'Interactive Console' }],
    },
    {
      id: 'protocols',
      title: 'Security Protocols',
      subsections: [
        { id: 'x3dh', title: 'X3DH Protocol' },
        { id: 'double-ratchet', title: 'Double Ratchet' },
        { id: 'ecdh', title: 'ECDH Key Exchange' },
      ],
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      subsections: [
        { id: 'endpoints', title: 'REST Endpoints' },
        { id: 'websocket', title: 'WebSocket API' },
        { id: 'errors', title: 'Error Handling' },
      ],
    },
    {
      id: 'sdks',
      title: 'SDKs & Libraries',
      subsections: [
        { id: 'javascript', title: 'JavaScript SDK' },
        { id: 'python', title: 'Python SDK' },
        { id: 'go', title: 'Go SDK' },
      ],
    },
    {
      id: 'guides',
      title: 'Guides & Tutorials',
      subsections: [
        { id: 'integration', title: 'Integration Guide' },
        { id: 'best-practices', title: 'Best Practices' },
        { id: 'deployment', title: 'Deployment' },
      ],
    },
  ]

  const contentMap = {
    intro: {
      title: 'Introduction to Echo',
      content: `Echo is a modern, privacy-first communication platform built on military-grade cryptography.
      
Our mission is to provide uncompromising security without sacrificing usability. Every message is encrypted end-to-end using the X3DH protocol and Double Ratchet algorithm, ensuring perfect forward secrecy.

Key principles:
- No backdoors. No exceptions.
- Zero-knowledge architecture - we never have access to your data
- Open source and auditable
- Standards-based cryptography
- Developer-friendly APIs`,
    },
    installation: {
      title: 'Installation',
      content: `Get started with Echo in minutes.

Using npm:
\`\`\`bash
npm install @echo/sdk
\`\`\`

Using yarn:
\`\`\`bash
yarn add @echo/sdk
\`\`\`

Using pnpm:
\`\`\`bash
pnpm add @echo/sdk
\`\`\`

Then import in your project:
\`\`\`javascript
import Echo from '@echo/sdk';

const client = new Echo({
  apiKey: 'your-api-key',
  baseURL: 'https://api.echo.dev'
});
\`\`\``,
    },
    quickstart: {
      title: 'Quick Start',
      content: `Initialize and send your first encrypted message in 3 steps.

Step 1: Initialize the client
\`\`\`javascript
const echo = new Echo({ apiKey: 'pk_live_...' });
\`\`\`

Step 2: Create a conversation
\`\`\`javascript
const conversation = await echo.conversations.create({
  participants: ['user@example.com', 'recipient@example.com']
});
\`\`\`

Step 3: Send a message
\`\`\`javascript
await conversation.send('Hello, world!');
\`\`\`

That's it! Your message is now encrypted end-to-end.`,
    },
    x3dh: {
      title: 'X3DH Protocol',
      content: `X3DH (Extended Triple Diffie-Hellman) is the key agreement protocol used by Echo to establish secure channels between devices.

The protocol works in three phases:

1. **Device Registration**: Each device uploads identity keys to the server
2. **Initial Exchange**: New conversations use X3DH to derive shared secrets
3. **Ratcheting**: Subsequent messages use Double Ratchet for perfect forward secrecy

Security guarantees:
- Forward secrecy: compromising keys doesn't reveal past messages
- Break-in recovery: keys refresh automatically between messages
- Authentication: cryptographic proof of peer identity`,
    },
    'double-ratchet': {
      title: 'Double Ratchet Algorithm',
      content: `The Double Ratchet algorithm provides forward and backward secrecy in ongoing conversations.

It uses two parallel ratchet functions:
- **DH Ratchet**: Derives new keys from Diffie-Hellman exchanges
- **KDF Ratchet**: Derives message keys from the chain key

Process:
1. Each message triggers a KDF ratchet step
2. Periodically, a new DH exchange happens (DH ratchet)
3. Receiving out-of-order messages is handled gracefully

This ensures that:
- Compromising a message key doesn't affect others
- Losing a key temporarily doesn't break the conversation
- Old messages remain secure even if current keys are stolen`,
    },
    ecdh: {
      title: 'ECDH Key Exchange',
      content: `Elliptic Curve Diffie-Hellman (ECDH) is the foundation of Echo's key establishment.

We use Curve25519 for its:
- Security: equivalent to 3072-bit RSA
- Performance: fast key generation and shared secret computation
- Auditability: widely standardized and peer-reviewed

The exchange process:
1. Each party generates an ephemeral key pair
2. Parties exchange public keys
3. Each computes the shared secret using their private key and peer's public key
4. The shared secret is used to derive message encryption keys

Echo implements ECDH with protection against:
- Man-in-the-middle attacks (through X3DH)
- Side-channel attacks (constant-time operations)
- Key recovery attacks (secure key derivation)`,
    },
    endpoints: {
      title: 'REST Endpoints',
      content: `Echo provides a comprehensive REST API for managing conversations and messages.

Authentication:
All requests require the Authorization header:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Key Endpoints:

**POST /conversations**
Create a new conversation
\`\`\`json
{
  "participants": ["user1@example.com", "user2@example.com"]
}
\`\`\`

**POST /conversations/{id}/messages**
Send a message
\`\`\`json
{
  "text": "Hello!",
  "ephemeral_ttl": 3600
}
\`\`\`

**GET /conversations**
List user's conversations

**GET /conversations/{id}/messages**
Get messages from a conversation`,
    },
    websocket: {
      title: 'WebSocket API',
      content: `Real-time communication is handled via WebSocket connections.

Connection:
\`\`\`javascript
const ws = new WebSocket('wss://ws.echo.dev');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};
\`\`\`

Message events:
\`\`\`javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'message') {
    console.log('New message:', msg.payload);
  }
};
\`\`\`

Supported events:
- \`message\`: Incoming encrypted message
- \`typing\`: User is typing indicator
- \`read\`: Message read receipt
- \`error\`: Error notification`,
    },
    errors: {
      title: 'Error Handling',
      content: `Echo uses standard HTTP status codes and detailed error responses.

Common errors:

**400 Bad Request**
Invalid parameters or malformed request
\`\`\`json
{
  "error": "validation_error",
  "details": {
    "participants": "must contain at least 2 addresses"
  }
}
\`\`\`

**401 Unauthorized**
Missing or invalid API key
\`\`\`json
{
  "error": "invalid_api_key"
}
\`\`\`

**429 Too Many Requests**
Rate limit exceeded. Try again after indicated delay.

**500 Internal Server Error**
Server error. Check status page at status.echo.dev`,
    },
    javascript: {
      title: 'JavaScript SDK',
      content: `The official Echo JavaScript SDK for Node.js and browsers.

Install:
\`\`\`bash
npm install @echo/sdk
\`\`\`

Basic usage:
\`\`\`javascript
import Echo from '@echo/sdk';

const client = new Echo({
  apiKey: process.env.ECHO_API_KEY
});

// Create conversation
const conv = await client.conversations.create({
  participants: ['alice@example.com', 'bob@example.com']
});

// Send message
await conv.send('Encrypted message');

// Listen for messages
conv.on('message', (msg) => {
  console.log('Decrypted:', msg.text);
});
\`\`\`

The SDK handles all encryption/decryption automatically.`,
    },
    python: {
      title: 'Python SDK',
      content: `The official Echo Python SDK for server-side applications.

Install:
\`\`\`bash
pip install echo-sdk
\`\`\`

Basic usage:
\`\`\`python
from echo import Client

client = Client(api_key='your_api_key')

# Create conversation
conv = client.conversations.create(
    participants=['alice@example.com', 'bob@example.com']
)

# Send message
conv.send('Your encrypted message here')

# Receive messages
for msg in conv.messages.stream():
    print(f'Message: {msg.text}')
\`\`\`

Perfect for bots, integrations, and backend services.`,
    },
    go: {
      title: 'Go SDK',
      content: `Build high-performance services with the Echo Go SDK.

Install:
\`\`\`bash
go get github.com/echo-dev/sdk-go
\`\`\`

Basic usage:
\`\`\`go
package main

import "github.com/echo-dev/sdk-go"

func main() {
  client := echo.NewClient(
    echo.WithAPIKey("your_api_key"),
  )

  conv, err := client.Conversations.Create(ctx, &echo.CreateConversationRequest{
    Participants: []string{"alice@example.com", "bob@example.com"},
  })
  
  conv.Send(ctx, "Encrypted message")
}
\`\`\`

Designed for low latency and high throughput.`,
    },
    integration: {
      title: 'Integration Guide',
      content: `Step-by-step guide to integrating Echo into your application.

1. Get API Keys
   - Sign up at echo.dev
   - Create API keys in your dashboard
   - Store securely as environment variables

2. Install SDK
   - Choose your language SDK
   - Follow SDK installation instructions

3. Initialize Client
   - Create Echo client instance
   - Configure with your API key

4. Create Conversations
   - Use your user IDs or emails
   - Conversations are created on-demand

5. Send/Receive Messages
   - All encryption happens automatically
   - Listen for incoming messages via webhooks or WebSocket

6. Deploy
   - Test in development environment
   - Deploy to production with secure key storage`,
    },
    'best-practices': {
      title: 'Best Practices',
      content: `Security and performance recommendations.

Security:
- Always use HTTPS/WSS in production
- Store API keys in environment variables
- Rotate keys regularly
- Implement rate limiting on your end
- Log security events

Performance:
- Batch API requests when possible
- Use WebSocket for real-time needs
- Implement exponential backoff for retries
- Cache conversation metadata
- Monitor API latency

Development:
- Test with the sandbox API first
- Use type-safe SDKs (TypeScript, Python typing)
- Validate user input before sending
- Implement proper error handling
- Keep SDK dependencies updated`,
    },
    deployment: {
      title: 'Deployment',
      content: `Deploy Echo in your infrastructure.

Docker:
\`\`\`dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
ENV ECHO_API_KEY=your_key
CMD ["npm", "start"]
\`\`\`

Kubernetes:
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: echo-keys
data:
  api-key: <base64-encoded-key>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo-service
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: ECHO_API_KEY
          valueFrom:
            secretKeyRef:
              name: echo-keys
              key: api-key
\`\`\`

Environment Variables:
- ECHO_API_KEY: Your API key
- ECHO_ENVIRONMENT: "production" or "sandbox"
- ECHO_LOG_LEVEL: "debug", "info", "warn", "error"`,
    },
  }

  const currentContent = contentMap[currentSection]

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(text)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Helper to render content with code blocks
  const renderContent = (content) => {
    if (!content) return null

    const parts = content.split(/(\`\`\`[\s\S]*?\`\`\`)/g)

    return parts.map((part, index) => {
      if (part.startsWith('\`\`\`')) {
        const match = part.match(/\`\`\`(\w+)?\n([\s\S]*?)\`\`\`/)
        if (!match) return null

        const language = match[1] || 'text'
        const code = match[2]

        return (
          <div key={index} className='relative my-6 group'>
            <div className='bg-black/50 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm'>
              <div className='flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.03]'>
                <span className='text-xs text-violet-300 uppercase tracking-wider font-semibold'>
                  {language}
                </span>
                <button
                  onClick={() => handleCopy(code)}
                  className='p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100'
                >
                  {copiedCode === code ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <pre className='text-sm font-mono text-zinc-300 leading-relaxed p-6 overflow-x-auto'>
                {code}
              </pre>
            </div>
          </div>
        )
      }

      // Handle bold text
      const textParts = part.split(/(\*\*.*?\*\*)/g)
      return (
        <p key={index} className='text-zinc-400 leading-relaxed mb-4'>
          {textParts.map((t, i) => {
            if (t.startsWith('**') && t.endsWith('**')) {
              return (
                <strong key={i} className='text-white font-semibold'>
                  {t.slice(2, -2)}
                </strong>
              )
            }
            return t
          })}
        </p>
      )
    })
  }

  return (
    <div className='min-h-screen flex flex-col bg-black text-white selection:bg-violet-500/30'>
      <Navbar />

      {/* Background Effects */}
      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px]' />
        <div className='absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px]' />
      </div>

      {/* Sidebar + Main Content wrapper */}
      <div className='flex flex-1 pt-20 relative z-10'>
        {/* Sidebar — fixed overlay on mobile, sticky in-flow on desktop */}
        <aside
          className={`w-72 shrink-0 bg-black/95 backdrop-blur-xl border-r border-white/10 overflow-y-auto transition-transform duration-300 z-40
          fixed top-20 left-0 bottom-0
          lg:sticky lg:top-20 lg:bottom-auto lg:h-[calc(100vh-5rem)] lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className='p-6'>
            {/* Search */}
            <div className='relative mb-8'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500' />
              <input
                type='text'
                placeholder='Search docs...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm transition-all'
              />
            </div>

            {/* Sections */}
            <nav className='space-y-6 pb-10'>
              {sections.map((section) => (
                <div key={section.id}>
                  <h3 className='px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2'>
                    {section.title}
                  </h3>
                  <div className='space-y-1'>
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setCurrentSection(sub.id)
                          setSidebarOpen(false)
                          window.scrollTo({ top: 0, behavior: 'instant' })
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                          currentSection === sub.id
                            ? 'bg-violet-600/10 text-violet-400 font-medium border border-violet-500/20'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className='flex-1 flex flex-col relative z-10'>
          <div className='flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full'>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className='lg:hidden mb-6 p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
            >
              {sidebarOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
            </button>

            {/* Breadcrumb */}
            <div className='flex items-center space-x-2 text-sm text-zinc-500 mb-8'>
              <Link to='/documentation' className='hover:text-violet-400 transition-colors'>
                Docs
              </Link>
              <ChevronRight className='w-4 h-4' />
              <span className='text-zinc-300'>{currentContent?.title}</span>
            </div>

            {/* Content */}
            <AnimatePresence mode='wait'>
              {currentSection === 'interactive' ? (
                <ApiPlayground key='playground' />
              ) : (
                <motion.div
                  key={currentSection}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className='min-h-[60vh]'
                >
                  <h1 className='text-4xl md:text-5xl font-bold text-white mb-8 tracking-tight'>
                    {currentContent?.title}
                  </h1>
                  <div className='prose prose-invert max-w-none'>
                    {renderContent(currentContent?.content)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className='flex justify-between items-center mt-16 pt-8 border-t border-white/10'>
              <button
                onClick={() => {
                  const allSections = sections.flatMap((s) => s.subsections)
                  const currentIndex = allSections.findIndex((s) => s.id === currentSection)
                  if (currentIndex > 0) {
                    setCurrentSection(allSections[currentIndex - 1].id)
                    window.scrollTo({ top: 0, behavior: 'instant' })
                  }
                }}
                className='group flex items-center space-x-2 text-zinc-400 hover:text-violet-400 transition-colors'
                disabled={currentSection === sections[0].subsections[0].id}
              >
                <ChevronRight className='w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform' />
                <span className='text-sm font-medium'>Previous</span>
              </button>

              <button
                onClick={() => {
                  const allSections = sections.flatMap((s) => s.subsections)
                  const currentIndex = allSections.findIndex((s) => s.id === currentSection)
                  if (currentIndex < allSections.length - 1) {
                    setCurrentSection(allSections[currentIndex + 1].id)
                    window.scrollTo({ top: 0, behavior: 'instant' })
                  }
                }}
                className='group flex items-center space-x-2 text-zinc-400 hover:text-violet-400 transition-colors'
              >
                <span className='text-sm font-medium'>Next</span>
                <ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
              </button>
            </div>
          </div>
        </main>
      </div>
      {/* end flex row */}
    </div>
  )
}

export default Documentation
