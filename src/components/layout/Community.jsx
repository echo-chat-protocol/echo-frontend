import { useState } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import toast, { Toaster } from 'react-hot-toast'
import Navbar from '@components/layout/Navbar'
import ParticlesBackground from '@components/animations/ParticlesBackground'
import Footer from '@components/layout/Footer'
import { FaDiscord, FaGithub, FaXTwitter } from 'react-icons/fa6'

const CommunityPage = () => {
  const [activeTab, setActiveTab] = useState('forum')
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [newPostForm, setNewPostForm] = useState({
    title: '',
    category: 'Discussion',
    content: '',
  })
  const [showNewPostForm, setShowNewPostForm] = useState(false)
  const [rsvpStatus, setRsvpStatus] = useState({})

  // Sample community data
  const forumPosts = [
    {
      id: 1,
      title: 'How to implement X3DH in my own project?',
      author: 'crypto_dev42',
      date: 'June 28, 2025',
      replies: 12,
      views: 145,
      category: 'Technical Help',
      excerpt:
        "I'm trying to implement the X3DH protocol similar to Echo but having trouble with the key exchange part...",
    },
    {
      id: 2,
      title: 'Security audit results discussion',
      author: 'EchoTeam',
      date: 'June 25, 2025',
      replies: 28,
      views: 320,
      category: 'Announcement',
      excerpt:
        "We've completed our first independent security audit. Here are the results and our response...",
    },
    {
      id: 3,
      title: 'Feature request: Voice messages',
      author: 'secure_user',
      date: 'June 22, 2025',
      replies: 45,
      views: 512,
      category: 'Feature Requests',
      excerpt:
        'Would love to see end-to-end encrypted voice messages in Echo. Anyone else interested in this feature?',
    },
    {
      id: 4,
      title: 'Rust vs Go for cryptographic implementations',
      author: 'lang_compare',
      date: 'June 20, 2025',
      replies: 36,
      views: 478,
      category: 'Discussion',
      excerpt:
        "I see Echo uses Rust. What are the advantages over Go for cryptographic operations? Let's discuss...",
    },
    {
      id: 5,
      title: 'Tutorial: Integrating Echo protocol in a React app',
      author: 'web_dev_101',
      date: 'June 18, 2025',
      replies: 8,
      views: 92,
      category: 'Tutorial',
      excerpt:
        "I wrote a step-by-step guide on how to integrate Echo's WASM modules in a React application...",
    },
  ]

  const events = [
    {
      id: 1,
      title: 'Echo Protocol Deep Dive Workshop',
      date: 'July 5, 2025',
      time: '14:00 UTC',
      location: 'Online',
      description:
        "Join our core developers for a technical workshop on Echo's protocol internals.",
      attendees: 87,
    },
    {
      id: 2,
      title: 'Echo Community Meetup - Madrid',
      date: 'July 12, 2025',
      time: '18:00 CET',
      location: 'Madrid, Spain',
      description:
        "Local meetup for Echo users and developers in the Madrid area. Network with the community and discuss Echo's future.",
      attendees: 31,
    },
    {
      id: 3,
      title: 'Echo Security & Privacy Workshop',
      date: 'July 20, 2025',
      time: '16:00 UTC',
      location: 'Online',
      description:
        "Deep dive into Echo's encryption methods, X3DH protocol implementation, and best practices for secure messaging.",
      attendees: 156,
    },
  ]

  const contributors = [
    {
      id: 1,
      name: 'Marcos Cabrero',
      role: 'Frontend Architect',
      avatar: '/community/marcos.jpg',
      joined: 'Oct 2024',
    },
    {
      id: 2,
      name: 'Miguel Ángel Mascaró',
      role: 'Security & Backend Engineer',
      avatar: '/community/mascaro.jpg',
      joined: 'Oct 2024',
    },
    {
      id: 3,
      name: 'Gonzalo de la Lastra',
      role: 'Quality Assurance Lead',
      avatar: '/community/gonchu.jpeg',
      joined: 'Oct 2024',
    },
  ]

  const handleNewPostSubmit = (e) => {
    e.preventDefault()
    toast.success(`Post "${newPostForm.title}" created successfully!`, {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#4BB543',
        color: '#fff',
      },
    })
    setShowNewPostForm(false)
    setNewPostForm({ title: '', category: 'Discussion', content: '' })
  }

  const handleRsvp = (eventId, eventTitle) => {
    setRsvpStatus((prev) => {
      const newStatus = !prev[eventId]
      if (newStatus) {
        toast.success(`You have registered for "${eventTitle}"!`, {
          duration: 4000,
          position: 'top-center',
          style: {
            background: '#4BB543',
            color: '#fff',
          },
        })
      } else {
        toast(`You have canceled your registration for "${eventTitle}"`, {
          duration: 4000,
          position: 'top-center',
        })
      }
      return {
        ...prev,
        [eventId]: newStatus,
      }
    })
  }

  const handleAddToCalendar = (event) => {
    toast(`Event "${event.title}" added to your calendar`, {
      duration: 4000,
      position: 'top-center',
      icon: '📅',
    })
  }

  const handleViewPost = (postTitle) => {
    toast(`Redirecting to "${postTitle}"...`, {
      duration: 2000,
      position: 'top-center',
      icon: '📝',
    })
  }

  const handleViewProfile = (contributorName) => {
    toast(`Showing profile of ${contributorName}...`, {
      duration: 2000,
      position: 'top-center',
      icon: '👤',
    })
  }

  return (
    <div className='min-h-screen bg-black text-gray-100 font-sans'>
      <ParticlesBackground />
      <Navbar />
      <Toaster /> {/* Component to show toasts */}
      <div className='relative z-10 pt-24 pb-16'>
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className='container mx-auto px-6 text-center'
          ref={ref}
        >
          <h1 className='text-5xl font-bold mb-6 text-white'>Echo Community</h1>
          <p className='text-lg text-gray-300 max-w-3xl mx-auto'>
            Join our growing community of security enthusiasts, developers, and privacy advocates.
          </p>
        </motion.div>
      </div>
      {/* Community Content */}
      <div className='relative z-10 py-12'>
        <div className='container mx-auto px-6'>
          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.2 }}
            className='flex border-b border-gray-700 mb-8'
          >
            <button
              onClick={() => setActiveTab('forum')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'forum'
                  ? 'text-white border-b-2 border-[#8e79f2]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Discussion Forum
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'events'
                  ? 'text-white border-b-2 border-[#8e79f2]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab('contributors')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'contributors'
                  ? 'text-white border-b-2 border-[#8e79f2]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Contributors
            </button>
          </motion.div>

          {/* Tab Content */}
          {activeTab === 'forum' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4 }}
              className='space-y-6'
            >
              <div className='flex justify-between items-center mb-6'>
                <h2 className='text-2xl font-bold text-white'>Latest Discussions</h2>
                <button
                  onClick={() => setShowNewPostForm(true)}
                  className='px-4 py-2 bg-[#8e79f2] hover:bg-[#7a65d8] rounded-md text-white font-medium transition-colors'
                >
                  New Post
                </button>
              </div>

              {showNewPostForm && (
                <div className='bg-black rounded-lg p-6 border border-white/10'>
                  <h3 className='text-xl font-bold text-white mb-4'>Create New Post</h3>
                  <form onSubmit={handleNewPostSubmit}>
                    <div className='mb-4'>
                      <label className='block text-gray-300 mb-2'>Title</label>
                      <input
                        type='text'
                        value={newPostForm.title}
                        onChange={(e) => setNewPostForm({ ...newPostForm, title: e.target.value })}
                        className='w-full bg-white/5 border border-white/10 rounded-md px-4 py-2 text-white placeholder-white/50 hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#8e79f2] transition-colors duration-200'
                        required
                      />
                    </div>
                    <div className='mb-4'>
                      <label className='block text-gray-300 mb-2'>Category</label>
                      <select
                        value={newPostForm.category}
                        onChange={(e) =>
                          setNewPostForm({ ...newPostForm, category: e.target.value })
                        }
                        className='w-full bg-white/5 border border-white/10 rounded-md px-4 py-2 text-white hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#8e79f2] transition-colors duration-200'
                      >
                        <option value='Discussion'>Discussion</option>
                        <option value='Technical Help'>Technical Help</option>
                        <option value='Feature Requests'>Feature Requests</option>
                        <option value='Announcement'>Announcement</option>
                        <option value='Tutorial'>Tutorial</option>
                      </select>
                    </div>
                    <div className='mb-4'>
                      <label className='block text-gray-300 mb-2'>Content</label>
                      <textarea
                        value={newPostForm.content}
                        onChange={(e) =>
                          setNewPostForm({ ...newPostForm, content: e.target.value })
                        }
                        className='w-full bg-white/5 border border-white/10 rounded-md px-4 py-2 text-white min-h-[150px] hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#8e79f2] transition-colors duration-200'
                        required
                      />
                    </div>
                    <div className='flex justify-end space-x-4'>
                      <button
                        type='button'
                        onClick={() => {
                          setShowNewPostForm(false)
                          toast('Post creation canceled', {
                            icon: '❌',
                          })
                        }}
                        className='px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#8e79f2]'
                      >
                        Cancel
                      </button>
                      <button
                        type='submit'
                        className='px-4 py-2 bg-[#8e79f2] hover:bg-[#7a65d8] rounded-md text-white font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20'
                      >
                        Submit Post
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {forumPosts.map((post) => (
                <div
                  key={post.id}
                  className='bg-white/5 rounded-lg p-6 border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer'
                  onClick={() => handleViewPost(post.title)}
                >
                  <div className='flex justify-between items-start mb-2'>
                    <span className='px-3 py-1 text-xs font-semibold bg-white/10 text-gray-200 rounded-full'>
                      {post.category}
                    </span>
                    <span className='text-xs text-gray-400'>{post.date}</span>
                  </div>
                  <h3 className='text-xl font-bold text-white mb-2 hover:text-gray-300'>
                    {post.title}
                  </h3>
                  <p className='text-gray-300 mb-4'>{post.excerpt}</p>
                  <div className='flex justify-between items-center text-sm text-gray-400'>
                    <span>by {post.author}</span>
                    <div className='flex space-x-4'>
                      <span>{post.replies} replies</span>
                      <span>{post.views} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'events' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4 }}
              className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'
            >
              {events.map((event) => (
                <div
                  key={event.id}
                  className='bg-white/5 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors'
                >
                  <div className='p-6'>
                    <div className='flex justify-between items-start mb-4'>
                      <div>
                        <h3 className='text-xl font-bold text-white mb-1'>{event.title}</h3>
                        <p className='text-gray-300'>{event.location}</p>
                      </div>
                      <span className='px-2 py-1 text-xs font-semibold bg-[#8e79f2]/20 text-[#8e79f2] rounded'>
                        {event.attendees + (rsvpStatus[event.id] ? 1 : 0)} attending
                      </span>
                    </div>
                    <div className='flex items-center text-gray-300 mb-4'>
                      <svg
                        className='w-5 h-5 mr-2'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                        />
                      </svg>
                      <span>
                        {event.date} at {event.time}
                      </span>
                    </div>
                    <p className='text-gray-300 mb-6'>{event.description}</p>
                    <div className='flex justify-between items-center'>
                      <button
                        onClick={() => handleRsvp(event.id, event.title)}
                        className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                          rsvpStatus[event.id]
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-[#8e79f2] hover:bg-[#7a65d8]'
                        }`}
                      >
                        {rsvpStatus[event.id] ? 'Attending ✓' : 'RSVP'}
                      </button>
                      <button
                        onClick={() => handleAddToCalendar(event)}
                        className='text-gray-300 hover:text-white text-sm font-medium'
                      >
                        Add to calendar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'contributors' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4 }}
              className='flex flex-wrap justify-center gap-6'
            >
              {contributors.map((contributor) => (
                <div
                  key={contributor.id}
                  className='bg-white/5 rounded-lg p-6 border border-gray-700 hover:border-gray-500 transition-colors text-center w-full sm:w-auto min-w-[280px]'
                >
                  <div className='w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-2 border-[#8e79f2] bg-gray-700 flex items-center justify-center'>
                    {contributor.avatar ? (
                      <img
                        src={contributor.avatar}
                        alt={contributor.name}
                        className='w-full h-full object-cover'
                      />
                    ) : (
                      <span className='text-2xl font-bold text-white'>
                        {contributor.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h3 className='text-xl font-bold text-white mb-1'>{contributor.name}</h3>
                  <p className='text-[#8e79f2] mb-2'>{contributor.role}</p>
                  <div className='flex justify-center space-x-4 text-sm text-gray-300 mb-4'>
                    <span>Joined {contributor.joined}</span>
                  </div>
                  <button
                    onClick={() => handleViewProfile(contributor.name)}
                    className='px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-white font-medium transition-colors'
                  >
                    View Profile
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          {/* Join Community CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className='mt-16 text-center'
          >
            <h2 className='text-3xl font-bold text-white mb-4'>Join Our Community</h2>
            <p className='text-gray-300 max-w-2xl mx-auto mb-8'>
              Connect with other security enthusiasts, contribute to the project, and help shape the
              future of private communication.
            </p>
            <div className='flex flex-wrap justify-center gap-4'>
              <a
                href='https://discord.gg/your-invite-link'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] rounded-md text-white font-medium transition-colors'
                onClick={() => toast('Redirecting to Discord...', { icon: '💬' })}
              >
                <FaDiscord className='w-5 h-5 mr-2' />
                Join Discord
              </a>

              <a
                href='https://github.com/your-repo'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 rounded-md text-white font-medium transition-colors'
                onClick={() => toast('Redirecting to GitHub...', { icon: '👨‍💻' })}
              >
                <FaGithub className='w-5 h-5 mr-2' />
                GitHub
              </a>

              <a
                href='https://twitter.com/your-handle'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 rounded-md text-white font-medium transition-colors'
                onClick={() => toast('Redirecting to Twitter...', { icon: '🐦' })}
              >
                <FaXTwitter className='w-5 h-5 mr-2' />
                Twitter
              </a>
            </div>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default CommunityPage
