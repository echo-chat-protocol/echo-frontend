import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Copy, Download } from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'
import gsap from 'gsap'

const APIPlayground = () => {
  const { t } = useTranslation()
  const [selectedEndpoint, setSelectedEndpoint] = useState('create-conversation')
  const [method, setMethod] = useState('POST')
  const [requestBody, setRequestBody] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const responseRef = useRef(null)

  const endpoints = [
    {
      id: 'create-conversation',
      name: 'Create Conversation',
      method: 'POST',
      path: '/conversations',
      description: 'Create a new conversation between participants',
      body: JSON.stringify(
        {
          participants: ['user1@example.com', 'user2@example.com'],
        },
        null,
        2
      ),
      mockResponse: {
        id: 'conv_123abc',
        participants: ['user1@example.com', 'user2@example.com'],
        created_at: new Date().toISOString(),
        encryption: 'X3DH',
      },
    },
    {
      id: 'send-message',
      name: 'Send Message',
      method: 'POST',
      path: '/conversations/{id}/messages',
      description: 'Send an encrypted message',
      body: JSON.stringify(
        {
          text: 'Hello, this is a secret message!',
          ephemeral_ttl: 3600,
        },
        null,
        2
      ),
      mockResponse: {
        id: 'msg_456def',
        conversation_id: 'conv_123abc',
        sender: 'user1@example.com',
        timestamp: new Date().toISOString(),
        encrypted: true,
      },
    },
    {
      id: 'list-conversations',
      name: 'List Conversations',
      method: 'GET',
      path: '/conversations',
      description: 'Get all conversations for the user',
      body: '',
      mockResponse: {
        conversations: [
          {
            id: 'conv_123abc',
            participants: ['user1@example.com', 'user2@example.com'],
            last_message_at: new Date().toISOString(),
          },
          {
            id: 'conv_456def',
            participants: ['user1@example.com', 'user3@example.com'],
            last_message_at: new Date().toISOString(),
          },
        ],
        count: 2,
      },
    },
    {
      id: 'get-messages',
      name: 'Get Messages',
      method: 'GET',
      path: '/conversations/{id}/messages',
      description: 'Retrieve messages from a conversation',
      body: '',
      mockResponse: {
        messages: [
          {
            id: 'msg_123',
            sender: 'user1@example.com',
            text: 'Hello',
            timestamp: new Date().toISOString(),
          },
          {
            id: 'msg_124',
            sender: 'user2@example.com',
            text: 'Hi there!',
            timestamp: new Date().toISOString(),
          },
        ],
        count: 2,
      },
    },
  ]

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint)

  const handleSendRequest = async () => {
    setLoading(true)

    // Mock API call
    setTimeout(() => {
      gsap.fromTo(
        responseRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      )

      setResponse(JSON.stringify(currentEndpoint.mockResponse, null, 2))
      setLoading(false)
    }, 800)
  }

  const copyResponse = () => {
    navigator.clipboard.writeText(response)
  }

  useEffect(() => {
    setRequestBody(currentEndpoint.body)
    setMethod(currentEndpoint.method)
    setResponse('')
  }, [selectedEndpoint, currentEndpoint])

  return (
    <div className='min-h-screen bg-neutral-950'>
      <Navbar />

      <main className='pt-24'>
        {/* Hero */}
        <section className='relative py-16 border-b border-primary-800/20'>
          <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
            <h1 className='text-4xl sm:text-5xl font-bold text-white mb-4'>API Playground</h1>
            <p className='text-neutral-400 text-lg'>Test Echo API endpoints interactively</p>
          </div>
        </section>

        {/* Playground */}
        <section className='relative py-12'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
              {/* Sidebar - Endpoints */}
              <div className='lg:col-span-1'>
                <h3 className='text-lg font-bold text-white mb-4'>Endpoints</h3>
                <div className='space-y-2'>
                  {endpoints.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => setSelectedEndpoint(ep.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-250 ${
                        selectedEndpoint === ep.id
                          ? 'bg-primary-950 border border-primary-600 text-primary-300'
                          : 'bg-neutral-900/50 border border-primary-800/20 text-neutral-400 hover:border-primary-600/40 hover:bg-neutral-900/70'
                      }`}
                    >
                      <div className='flex items-center space-x-2 mb-1'>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            ep.method === 'GET'
                              ? 'bg-blue-900 text-blue-300'
                              : ep.method === 'POST'
                                ? 'bg-green-900 text-green-300'
                                : 'bg-purple-900 text-purple-300'
                          }`}
                        >
                          {ep.method}
                        </span>
                      </div>
                      <p className='font-semibold text-sm'>{ep.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Content */}
              <div className='lg:col-span-2'>
                {currentEndpoint && (
                  <div className='space-y-6'>
                    {/* Endpoint Info */}
                    <div>
                      <h2 className='text-2xl font-bold text-white mb-2'>{currentEndpoint.name}</h2>
                      <p className='text-neutral-400 mb-4'>{currentEndpoint.description}</p>
                      <div className='flex items-center space-x-2 text-sm font-mono'>
                        <span
                          className={`font-bold px-3 py-1 rounded ${
                            currentEndpoint.method === 'GET'
                              ? 'bg-blue-900 text-blue-300'
                              : 'bg-green-900 text-green-300'
                          }`}
                        >
                          {currentEndpoint.method}
                        </span>
                        <span className='text-primary-400'>{currentEndpoint.path}</span>
                      </div>
                    </div>

                    {/* Request */}
                    <div>
                      <h3 className='text-lg font-bold text-white mb-3'>Request</h3>
                      {currentEndpoint.method === 'POST' ? (
                        <textarea
                          value={requestBody}
                          onChange={(e) => setRequestBody(e.target.value)}
                          className='w-full h-40 p-4 bg-neutral-900 border border-primary-800/20 rounded-lg text-neutral-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-600'
                        />
                      ) : (
                        <div className='p-4 bg-neutral-900 border border-primary-800/20 rounded-lg text-neutral-500 text-sm'>
                          GET request - no body required
                        </div>
                      )}
                    </div>

                    {/* Send Button */}
                    <button
                      onClick={handleSendRequest}
                      disabled={loading}
                      className='w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors duration-250'
                    >
                      <Play className='w-5 h-5' />
                      <span>{loading ? 'Sending...' : 'Send Request'}</span>
                    </button>

                    {/* Response */}
                    {response && (
                      <div ref={responseRef}>
                        <h3 className='text-lg font-bold text-white mb-3'>Response</h3>
                        <div className='relative'>
                          <pre className='p-4 bg-neutral-900 border border-primary-600/30 rounded-lg text-emerald-400 font-mono text-xs overflow-x-auto max-h-80'>
                            {response}
                          </pre>
                          <button
                            onClick={copyResponse}
                            className='absolute top-2 right-2 p-2 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-400 hover:text-primary-400 transition-colors duration-250'
                          >
                            <Copy className='w-4 h-4' />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Documentation Link */}
        <section className='relative py-16 bg-neutral-900/50 border-y border-primary-800/20'>
          <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
            <h2 className='text-2xl font-bold text-white mb-4'>Need More Details?</h2>
            <p className='text-neutral-400 mb-6'>
              Check our complete API reference for all endpoints, parameters, and error codes.
            </p>
            <a
              href='/documentation'
              className='inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors duration-250'
            >
              <span>Read API Docs</span>
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default APIPlayground
