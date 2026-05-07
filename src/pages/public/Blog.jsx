import { useState } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import Navbar from './Navbar.jsx'
import ParticlesBackground from './ParticlesBackground.jsx'
import Footer from './Footer.jsx'

const BlogPage = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const postsPerPage = 4
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  // Datos de los posts del blog
  const blogPosts = [
    {
      id: 1,
      title: 'Introducing Echo: A Secure Chat Protocol Built with Rust',
      date: 'June 1, 2025',
      excerpt:
        'Discover how Echo implements end-to-end encryption inspired by Signal Protocol using custom Rust modules for maximum security.',
      imageUrl: '/EchoProtocolLogo.png',
      link: '#',
      category: 'Announcement',
    },
    {
      id: 2,
      title: "Throwback: Echo's First Logo (When It Was Chat-Tuah)",
      date: 'June 2, 2025',
      excerpt:
        "A peek at Echo's original design when it started as Chat-Tuah. Recognize the soda can?",
      imageUrl: '/sodaCan.svg',
      link: '#',
      category: 'Sneak Peek',
      tags: ['history', 'design', 'throwback'],
    },
    {
      id: 3,
      title: "Deep Dive into X3DH: Echo's Key Exchange Protocol",
      date: 'June 3, 2025',
      excerpt:
        'Learn how Echo implements the Extended Triple Diffie-Hellman protocol to establish secure shared secrets between users.',
      imageUrl: '/blog/X3DH.png',
      link: '#',
      category: 'Technical',
    },
    {
      id: 4,
      title: 'Why We Chose Rust for Cryptographic Operations',
      date: 'June 5, 2025',
      excerpt:
        "Exploring the benefits of Rust for security-critical applications and how it powers Echo's cryptographic modules.",
      imageUrl: '/blog/rust-logo.png',
      link: '#',
      category: 'Development',
    },
    {
      id: 5,
      title: "Understanding XEdDSA: Echo's Signature Scheme",
      date: 'June 8, 2025',
      excerpt:
        'A comprehensive guide to XEdDSA and how it enables secure authentication in the Echo protocol.',
      imageUrl: '/echo-logo-text.png',
      link: '#',
      category: 'Technical',
    },
    {
      id: 6,
      title: 'From Montgomery to Edwards: Key Conversion in Echo',
      date: 'June 10, 2025',
      excerpt: 'How Echo handles the conversion between curve forms for cryptographic operations.',
      imageUrl: '/blog/programming.jpg',
      link: '#',
      category: 'Technical',
    },
    {
      id: 7,
      title: 'The Importance of Clamping in Elliptic Curve Cryptography',
      date: 'June 12, 2025',
      excerpt: 'Why Echo implements key clamping and how it protects against subgroup attacks.',
      imageUrl: '/blog/cryptography.jpeg',
      link: '#',
      category: 'Security',
    },
    {
      id: 8,
      title: 'Building WASM Modules for Echo: A Step-by-Step Guide',
      date: 'June 15, 2025',
      excerpt:
        "How we compiled Rust cryptographic modules to WebAssembly for use in Echo's web client.",
      imageUrl: '/blog/wasm.png',
      link: '#',
      category: 'Tutorial',
    },
    {
      id: 9,
      title: "Echo's Forward Secrecy Implementation Explained",
      date: 'June 18, 2025',
      excerpt:
        'How Echo ensures that past communications remain secure even if long-term keys are compromised.',
      imageUrl: '/blog/programming.jpg',
      link: '#',
      category: 'Security',
    },
    {
      id: 10,
      title: "Benchmarking Echo's Cryptographic Operations",
      date: 'June 20, 2025',
      excerpt:
        "Performance analysis of Echo's Rust cryptographic modules compared to other implementations.",
      imageUrl: '/blog/benchmark.jpg',
      link: '#',
      category: 'Performance',
    },
    {
      id: 11,
      title: "The Role of One-Time Prekeys in Echo's Security",
      date: 'June 22, 2025',
      excerpt: 'How Echo uses OPKs to provide additional protection and forward secrecy.',
      imageUrl: '/blog/cybersecurity.jpeg',
      link: '#',
      category: 'Security',
    },
    {
      id: 12,
      title: 'Verifying Signatures in Echo: The XEdDSA Process',
      date: 'June 25, 2025',
      excerpt:
        'A step-by-step walkthrough of how signature verification works in the Echo protocol.',
      imageUrl: '/blog/office.jpg',
      link: '#',
      category: 'Technical',
    },
    {
      id: 13,
      title: "How Echo's Key Derivation Function Works",
      date: 'June 28, 2025',
      excerpt:
        'Understanding the KDF that combines multiple DH results into a single secure session key.',
      imageUrl: '/blog/dh.png',
      link: '#',
      category: 'Technical',
    },
    {
      id: 14,
      title: 'The Student Journey: Building a Secure Chat App from Scratch',
      date: 'July 1, 2025',
      excerpt:
        'The story of how three students developed Echo as part of their IMMUNE Institute program.',
      imageUrl: '/blog/office.jpg',
      link: '#',
      category: 'Story',
    },
    {
      id: 15,
      title: "Comparing Echo's Protocol to Signal and Other Secure Messengers",
      date: 'July 3, 2025',
      excerpt:
        "How Echo's security model differs from and improves upon existing secure messaging protocols.",
      imageUrl: '/EchoProtocolLogo.png',
      link: '#',
      category: 'Analysis',
    },
    {
      id: 16,
      title: "Future Roadmap for Echo: What's Coming Next",
      date: 'July 5, 2025',
      excerpt:
        'A look at planned features and improvements for the Echo secure messaging platform.',
      imageUrl: '/blog/roadmap.jpg',
      link: '#',
      category: 'Announcement',
    },
  ]

  // Filtrar posts según el término de búsqueda
  const filteredPosts = blogPosts.filter(
    (post) =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Lógica de paginación
  const indexOfLastPost = currentPage * postsPerPage
  const indexOfFirstPost = indexOfLastPost - postsPerPage
  const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost)
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage)

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  return (
    <div className='min-h-screen bg-black text-gray-100 font-sans'>
      <ParticlesBackground />
      <Navbar />

      <div className='relative z-10 pt-24 pb-16'>
        {/* Hero Section for Blog */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className='container mx-auto px-6 text-center'
          ref={ref}
        >
          <h1 className='text-5xl font-bold mb-6 text-white'>Our Blog</h1>
          <p className='text-lg text-gray-300 max-w-3xl mx-auto'>
            Stay updated with the latest news, features, and announcements from our team.
          </p>

          {/* Search Bar */}
          <div className='relative max-w-2xl mx-auto mt-8'>
            <input
              type='text'
              placeholder='Search articles...'
              value={searchTerm}
              onChange={handleSearch}
              className='w-full px-6 py-3 bg-white/10 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-[#8e79f2] focus:border-[#8e79f2] text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300'
            />
            <button className='absolute right-4 top-3 text-gray-400 hover:text-white'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-6 w-6'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                />
              </svg>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Blog Content */}
      <div className='relative z-10 py-12'>
        <div className='container mx-auto px-6'>
          {/* Mostrar mensaje si no hay resultados */}
          {filteredPosts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 }}
              className='text-center py-12'
            >
              <h2 className='text-2xl font-bold text-white mb-4'>No results found</h2>
              <p className='text-gray-300'>Try different search terms</p>
            </motion.div>
          ) : (
            <>
              {/* Featured Post */}
              {currentPage === 1 && searchTerm === '' && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className='mb-16'
                >
                  <div className='bg-gradient-to-r from-gray-900/30 to-black/30 rounded-2xl shadow-xl overflow-hidden border border-gray-700 backdrop-blur-sm'>
                    <div className='md:flex h-full'>
                      <div className='md:w-1/2 relative min-h-[300px] md:min-h-[400px]'>
                        <img
                          className='absolute inset-0 w-full h-full object-contain p-6 md:p-8 bg-black/20'
                          src='/EchoProtocolLogo.png'
                          alt={blogPosts[0].title}
                          loading='eager'
                        />
                      </div>

                      {/* Contenido */}
                      <div className='p-6 md:p-8 md:w-1/2 flex flex-col'>
                        <div className='inline-block px-3 py-1 text-sm font-semibold bg-white/10 text-gray-200 rounded-full mb-4 self-start'>
                          {blogPosts[0].category}
                        </div>

                        <div className='text-gray-400 text-sm mb-2'>{blogPosts[0].date}</div>

                        <h2 className='text-2xl md:text-3xl font-bold text-white hover:text-gray-300 mb-4'>
                          <a href={blogPosts[0].link}>{blogPosts[0].title}</a>
                        </h2>

                        <p className='text-gray-300 mb-6 flex-grow'>{blogPosts[0].excerpt}</p>

                        <div className='mt-auto'>
                          <a
                            href={blogPosts[0].link}
                            className='inline-flex items-center group text-gray-300 hover:text-white font-medium transition-colors'
                          >
                            Read more
                            <svg
                              className='w-4 h-4 ml-2 transition-transform group-hover:translate-x-1'
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M9 5l7 7-7 7'
                              />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Blog Posts Grid */}
              <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16'>
                {(searchTerm ? filteredPosts : currentPosts.slice(searchTerm ? 0 : 1)).map(
                  (post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 50 }}
                      animate={inView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.8, delay: 0.1 * index }}
                      className='bg-white/10 rounded-xl shadow-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-all backdrop-blur-sm'
                    >
                      {/* Contenedor de imagen ajustado (más pequeño y centrado) */}
                      <div className='w-full h-40 flex items-center justify-center bg-black/10 p-4'>
                        <img
                          className='max-h-[90%] max-w-[90%] object-contain'
                          src={post.imageUrl}
                          alt={post.title}
                        />
                      </div>
                      <div className='p-6'>
                        <div className='flex justify-between items-center mb-3'>
                          <span className='px-2 py-1 text-xs font-semibold bg-white/10 text-gray-200 rounded'>
                            {post.category}
                          </span>
                          <span className='text-xs text-gray-400'>{post.date}</span>
                        </div>
                        <a
                          href={post.link}
                          className='block text-xl font-bold text-white hover:text-gray-300 mb-2'
                        >
                          {post.title}
                        </a>
                        <p className='text-gray-300 text-sm mb-4'>{post.excerpt}</p>
                        <a
                          href={post.link}
                          className='inline-flex items-center text-gray-300 hover:text-white text-sm font-medium transition-colors'
                        >
                          Read more
                          <svg
                            className='w-4 h-4 ml-1'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M9 5l7 7-7 7'
                            />
                          </svg>
                        </a>
                      </div>
                    </motion.div>
                  )
                )}
              </div>
            </>
          )}

          {filteredPosts.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.6 }}
              className='flex justify-center'
            >
              <nav className='flex items-center space-x-2'>
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className='p-2 rounded-md text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M15 19l-7-7 7-7'
                    />
                  </svg>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                  <button
                    key={number}
                    onClick={() => setCurrentPage(number)}
                    className={`px-4 py-2 rounded-md ${
                      currentPage === number
                        ? 'bg-white/20 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className='p-2 rounded-md text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 5l7 7-7 7'
                    />
                  </svg>
                </button>
              </nav>
            </motion.div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default BlogPage
