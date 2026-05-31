import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, User } from 'lucide-react'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import { getSocket } from '../../socket'
import { resolveApiBase } from '@/utils/network/apiBase'

// Firebase config
const firebaseConfig = {
  apiKey: 'AIzaSyC3dqQgY1dEE4F2Cdb6zv0rQRcC91CxZVo',
  authDomain: 'webrtc-app-a0607.firebaseapp.com',
  projectId: 'webrtc-app-a0607',
  storageBucket: 'webrtc-app-a0607.firebasestorage.app',
  messagingSenderId: '429607886523',
  appId: '1:429607886523:web:df9c41d3e8c69cf746939e',
  measurementId: 'G-WSBW8BK3P4',
}

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig)
}
const firestore = firebase.firestore()

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
}

const VideoCall = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { odebukiUserId } = useParams()
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const callIdRef = useRef('')

  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [callId, setCallId] = useState('')
  const [callStatus, setCallStatus] = useState('idle')
  const [hasVideoPermission, setHasVideoPermission] = useState(true)
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true)
  const [localUserProfile, setLocalUserProfile] = useState(null)
  const [remoteUserProfile, setRemoteUserProfile] = useState(null)

  const hasStartedCallRef = useRef(false)

  // Check if we're answering a call (came from notification)
  const isAnswering = location.state?.callId
  const search = new URLSearchParams(location.search)
  const isAudioOnlyMode = search.get('type') === 'audio' || search.get('audioOnly') === '1'

  // Fetch user profiles
  useEffect(() => {
    const fetchProfiles = () => {
      const socket = getSocket()
      const username = localStorage.getItem('username')
      const userId = localStorage.getItem('userId')

      // Get local user profile from localStorage using the correct key pattern
      const storedProfile = localStorage.getItem(`profile-${userId}`)
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile)
          setLocalUserProfile({
            username: profile.username || username,
            profileImage: profile.profilePicture || profile.profileImage || null,
          })
        } catch (e) {
          console.error('Error parsing stored profile:', e)
        }
      } else {
        // Fallback to just username
        setLocalUserProfile({
          username: username || 'You',
          profileImage: null,
        })
      }

      // Fetch remote user profile via socket - ALWAYS prefer fresh data from server
      socket.emit('fetchUsername', odebukiUserId, (response) => {
        if (response) {
          // Backend might send profilePicture or profileImage
          let profilePic = response.profilePicture || response.profileImage || null

          // If socket doesn't return profile picture, check localStorage as fallback
          if (!profilePic) {
            const cachedProfile = localStorage.getItem(`profile-${odebukiUserId}`)
            if (cachedProfile) {
              try {
                const parsed = JSON.parse(cachedProfile)
                profilePic = parsed.profilePicture || parsed.profileImage || null
              } catch (e) {
                console.error('Error parsing cached profile:', e)
              }
            }
          }

          setRemoteUserProfile({
            username: response.username || 'User',
            profileImage: profilePic,
          })

          // Update localStorage cache with data from server (keep cached pic if server doesn't have one)
          localStorage.setItem(
            `profile-${odebukiUserId}`,
            JSON.stringify({
              username: response.username,
              profilePicture: profilePic,
            })
          )
        } else {
          console.error('❌ fetchUsername returned no response')
        }
      })
    }

    fetchProfiles()
  }, [odebukiUserId])

  // Listen for profile updates (both local and remote users)
  useEffect(() => {
    const socket = getSocket()

    // Handle local user profile updates
    const handleLocalProfileUpdate = () => {
      const username = localStorage.getItem('username')
      const userId = localStorage.getItem('userId')
      const storedProfile = localStorage.getItem(`profile-${userId}`)

      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile)
          setLocalUserProfile({
            username: profile.username || username,
            profileImage: profile.profilePicture || profile.profileImage || null,
          })
        } catch (e) {
          console.error('Error updating local profile:', e)
        }
      }
    }

    // Handle remote user profile updates via socket
    const handleRemoteProfileUpdate = (data) => {
      const { userId: updatedUserId, username, profilePicture } = data

      // Check if this is the remote user we're calling
      if (updatedUserId === odebukiUserId) {
        setRemoteUserProfile({
          username: username || 'User',
          profileImage: profilePicture || null,
        })

        // Also update localStorage cache
        const cachedProfile = localStorage.getItem(`profile-${updatedUserId}`)
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile)
            localStorage.setItem(
              `profile-${updatedUserId}`,
              JSON.stringify({
                ...parsed,
                username: username || parsed.username,
                profilePicture: profilePicture,
              })
            )
          } catch (e) {
            console.error('Error updating cached profile:', e)
          }
        }
      }
    }

    window.addEventListener('profileUpdated', handleLocalProfileUpdate)
    socket.on('userProfileUpdated', handleRemoteProfileUpdate)

    return () => {
      window.removeEventListener('profileUpdated', handleLocalProfileUpdate)
      socket.off('userProfileUpdated', handleRemoteProfileUpdate)
    }
  }, [odebukiUserId])

  useEffect(() => {
    callIdRef.current = callId
  }, [callId])

  useEffect(() => {
    const socket = getSocket()

    // Initialize peer connection
    pcRef.current = new RTCPeerConnection(servers)
    remoteStreamRef.current = new MediaStream()

    const startCamera = async () => {
      if (hasStartedCallRef.current) return
      hasStartedCallRef.current = true

      try {
        // Determine capture constraints based on mode; in audio-only mode we
        // explicitly skip camera setup and present avatar UIs instead.
        let mediaStream
        if (isAudioOnlyMode) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            setHasVideoPermission(false)
            setIsCameraOff(true)
          } catch {
            // No mic permission — proceed without tracks
            setIsMuted(true)
          }
        } else {
          // Try to get both video and audio
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            })
            setHasVideoPermission(true)
          } catch {
            // Try video only
            let videoStream = null
            try {
              videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
              setHasVideoPermission(true)
            } catch {
              setHasVideoPermission(false)
              setIsCameraOff(true)
            }

            // Try audio only
            let audioStream = null
            try {
              audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            } catch {
              setIsMuted(true)
            }

            // Combine streams
            if (videoStream || audioStream) {
              mediaStream = new MediaStream()
              if (videoStream) videoStream.getTracks().forEach((t) => mediaStream.addTrack(t))
              if (audioStream) audioStream.getTracks().forEach((t) => mediaStream.addTrack(t))
            }
          }
        }

        localStreamRef.current = mediaStream || null

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream || null
        }

        // Push tracks from local stream to peer connection
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => {
            pcRef.current.addTrack(track, mediaStream)
          })
        }

        // Pull tracks from remote stream, add to video stream
        pcRef.current.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStreamRef.current.addTrack(track)

            // Listen for track enabled/disabled events
            track.onended = () => {}

            // Monitor remote video track state
            if (track.kind === 'video') {
              track.onmute = () => setRemoteVideoEnabled(false)
              track.onunmute = () => setRemoteVideoEnabled(true)
            }
          })
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current
        }

        // If answering a call, automatically answer
        if (isAnswering) {
          setCallId(location.state.callId)
          setTimeout(() => {
            handleAnswerCall(location.state.callId)
            socket.emit('acceptCall', { callId: location.state.callId })
          }, 500)
        } else {
          // If initiating a call, create offer and notify the target user
          handleCreateCall()
        }
      } catch (error) {
        console.error('Error accessing camera/microphone:', error)
        alert('Could not access camera or microphone. The call will start without media.')
        // Continue with call even without permissions
        if (isAnswering) {
          setCallId(location.state.callId)
          setTimeout(() => {
            handleAnswerCall(location.state.callId)
            socket.emit('acceptCall', { callId: location.state.callId })
          }, 500)
        } else {
          handleCreateCall()
        }
      }
    }

    // Wait for socket to connect then start camera
    const initCall = () => {
      startCamera()
    }

    if (socket.connected) {
      initCall()
    } else {
      socket.on('connect', initCall)
    }

    // Helper to stop all media
    const stopMedia = () => {
      // Stop all tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop()
        })
        localStreamRef.current = null
      }
      // Clear video element sources
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current = null
      }
      // Close peer connection
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
    }

    // Listen for call declined
    socket.on('callDeclined', () => {
      alert('Call was declined')
      stopMedia()
      navigate(-1)
    })

    // Listen for call ended by other user
    socket.on('callEnded', () => {
      stopMedia()
      navigate(-1)
    })

    // Listen for remote video state changes
    socket.on('videoStateChanged', ({ isEnabled }) => {
      setRemoteVideoEnabled(isEnabled)
    })

    // Listen for remote audio state changes (optional, for future UI indicators)
    socket.on('audioStateChanged', () => {
      // Could add a state variable to show muted indicator on remote user
    })

    return () => {
      stopMedia()
      socket.off('connect', initCall)
      socket.off('callDeclined')
      socket.off('callEnded')
      socket.off('videoStateChanged')
      socket.off('audioStateChanged')
    }
  }, [navigate])

  // Create a call (caller)
  const handleCreateCall = async () => {
    // Allow creating and connecting a call even without local media tracks —
    // the SDP will simply be recvonly until media is enabled.
    if (!pcRef.current) return

    const socket = getSocket()
    const callDoc = firestore.collection('calls').doc()
    const offerCandidates = callDoc.collection('offerCandidates')
    const answerCandidates = callDoc.collection('answerCandidates')

    setCallId(callDoc.id)
    setCallStatus('calling')

    // Get candidates for caller, save to db
    pcRef.current.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON())
    }

    // Create offer
    const offerDescription = await pcRef.current.createOffer()
    await pcRef.current.setLocalDescription(offerDescription)

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    }

    await callDoc.set({ offer })

    // Send call notification to target user via socket
    socket.emit('initiateCall', {
      targetUserId: odebukiUserId,
      callId: callDoc.id,
    })

    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data()
      if (!pcRef.current.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer)
        pcRef.current.setRemoteDescription(answerDescription)
        setCallStatus('connected')
      }
    })

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data())
          pcRef.current.addIceCandidate(candidate)
        }
      })
    })
  }

  // Answer a call (callee)
  const handleAnswerCall = async (incomingCallId) => {
    const callIdToUse = incomingCallId || callId
    if (!callIdToUse || !pcRef.current) return

    const callDoc = firestore.collection('calls').doc(callIdToUse)
    const answerCandidates = callDoc.collection('answerCandidates')
    const offerCandidates = callDoc.collection('offerCandidates')

    pcRef.current.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON())
    }

    const callData = (await callDoc.get()).data()

    if (!callData) {
      alert('Call not found!')
      return
    }

    const offerDescription = callData.offer
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offerDescription))

    const answerDescription = await pcRef.current.createAnswer()
    await pcRef.current.setLocalDescription(answerDescription)

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    }

    await callDoc.update({ answer })

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data()
          pcRef.current.addIceCandidate(new RTCIceCandidate(data))
        }
      })
    })

    setCallStatus('connected')
  }

  const handleEndCall = () => {
    const socket = getSocket()

    // Notify the other user
    socket.emit('endCall', { callId })

    // Stop all media tracks (camera and microphone)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      localStreamRef.current = null
    }

    // Clear video element sources
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current = null
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    navigate(-1)
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      if (audioTracks.length > 0) {
        const newMutedState = !isMuted
        audioTracks.forEach((track) => {
          track.enabled = !newMutedState
        })
        setIsMuted(newMutedState)

        // Notify remote user about audio state change
        const socket = getSocket()
        socket.emit('audioStateChanged', {
          targetUserId: odebukiUserId,
          isEnabled: !newMutedState,
        })
      }
    }
  }

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks()
      if (videoTracks.length > 0) {
        const newCameraOffState = !isCameraOff
        videoTracks.forEach((track) => {
          track.enabled = !newCameraOffState
        })
        setIsCameraOff(newCameraOffState)

        // Notify remote user about video state change
        const socket = getSocket()
        socket.emit('videoStateChanged', {
          targetUserId: odebukiUserId,
          isEnabled: !newCameraOffState,
        })
      }
    }
  }

  // Helper function for consistent avatar colors
  const getConsistentColor = (username) => {
    const colors = ['FF5733', '33FF57', '3357FF', 'F033FF', 'FF33F0']
    return colors[username.length % colors.length]
  }

  // Get profile image with fallback
  const getProfileImage = (profile) => {
    if (!profile) return null

    // Check if profile has a custom image (not empty string, null, or undefined)
    const hasCustomImage = profile.profileImage && profile.profileImage.trim().length > 0

    let imageUrl
    if (hasCustomImage) {
      // If the path starts with /, prepend the backend URL
      imageUrl = profile.profileImage.startsWith('/')
        ? `${resolveApiBase()}${profile.profileImage}`
        : profile.profileImage
    } else {
      // Fallback to UI Avatars
      imageUrl = `https://ui-avatars.com/api/?name=${profile.username}&background=${getConsistentColor(profile.username)}&color=fff`
    }

    return imageUrl
  }

  return (
    <div className='h-[100dvh] bg-black flex flex-col overflow-hidden'>
      {/* Video area */}
      <div className='flex-1 min-h-0 relative flex items-center justify-center overflow-hidden'>
        {/* Remote video */}
        <div className='w-full h-full min-h-0 bg-gray-900 flex flex-col relative overflow-hidden'>
          <div className='flex-1 min-h-0 relative flex items-center justify-center overflow-hidden'>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${!remoteVideoEnabled && callStatus === 'connected' ? 'hidden' : ''}`}
            />
            {callStatus !== 'connected' && (
              <div className='absolute inset-0 flex flex-col items-center justify-center'>
                {remoteUserProfile ? (
                  <>
                    <img
                      src={getProfileImage(remoteUserProfile)}
                      alt={remoteUserProfile.username}
                      className='w-48 h-48 rounded-full object-cover mb-4'
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${remoteUserProfile.username}&background=${getConsistentColor(remoteUserProfile.username)}&color=fff`
                      }}
                    />
                    <p className='text-white text-xl'>{remoteUserProfile.username}</p>
                  </>
                ) : (
                  <div className='grid h-44 w-44 place-items-center rounded-full bg-white/[0.03] ring-1 ring-white/10'>
                    <User size={72} className='text-white/30' />
                  </div>
                )}
              </div>
            )}
            {callStatus === 'connected' && !remoteVideoEnabled && (
              <div className='absolute inset-0 flex flex-col items-center justify-center bg-gray-900'>
                {remoteUserProfile ? (
                  <>
                    <img
                      src={getProfileImage(remoteUserProfile)}
                      alt={remoteUserProfile.username}
                      className='w-48 h-48 rounded-full object-cover mb-4'
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${remoteUserProfile.username}&background=${getConsistentColor(remoteUserProfile.username)}&color=fff`
                      }}
                    />
                    <p className='text-white text-xl'>{remoteUserProfile.username}</p>
                  </>
                ) : (
                  <div className='grid h-44 w-44 place-items-center rounded-full bg-white/[0.03] ring-1 ring-white/10'>
                    <User size={72} className='text-white/30' />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Local video (small overlay) */}
        <div className='absolute bottom-4 right-4 flex h-36 w-28 flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/60 shadow-xl sm:h-48 sm:w-64'>
          <div className='flex-1 min-h-0 relative overflow-hidden'>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isCameraOff || !hasVideoPermission ? 'hidden' : ''}`}
            />
            {(isCameraOff || !hasVideoPermission) &&
              (() => {
                return (
                  <div className='absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-800'>
                    {localUserProfile ? (
                      <>
                        <img
                          src={getProfileImage(localUserProfile)}
                          alt={localUserProfile.username}
                          className='w-24 h-24 rounded-full object-cover mb-2'
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${localUserProfile.username}&background=${getConsistentColor(localUserProfile.username)}&color=fff`
                          }}
                        />
                        <p className='text-white text-sm'>{localUserProfile.username}</p>
                      </>
                    ) : (
                      <User size={28} className='text-white/40' />
                    )}
                  </div>
                )
              })()}
          </div>
        </div>

        {/* Call status */}
        {callStatus === 'calling' && (
          <div className='absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+1rem)] -translate-x-1/2 rounded-full border border-white/[0.08] bg-black/60 px-4 py-1.5 backdrop-blur'>
            <p className='flex items-center gap-2 text-[12px] text-white/80'>
              <span className='inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400' />
              Calling…
            </p>
          </div>
        )}

        {callStatus === 'connected' && (
          <div className='absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+1rem)] -translate-x-1/2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-1.5 backdrop-blur'>
            <p className='flex items-center gap-2 text-[12px] text-emerald-300'>
              <span className='inline-block h-1.5 w-1.5 rounded-full bg-emerald-400' />
              Connected
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className='flex shrink-0 justify-center gap-3 border-t border-white/[0.05] bg-black/80 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur md:gap-4'>
        <button
          className={`grid h-14 w-14 place-items-center rounded-full text-white transition active:scale-95 ${
            isMuted ? 'bg-red-500/90 hover:bg-red-500' : 'bg-white/[0.08] hover:bg-white/[0.14]'
          }`}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={isMuted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button
          className={`grid h-14 w-14 place-items-center rounded-full text-white transition active:scale-95 ${
            isCameraOff ? 'bg-red-500/90 hover:bg-red-500' : 'bg-white/[0.08] hover:bg-white/[0.14]'
          }`}
          aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          title={isCameraOff ? 'Camera on' : 'Camera off'}
          onClick={toggleCamera}
        >
          {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>

        <button
          className='grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-500 active:scale-95'
          aria-label='End call'
          title='End call'
          onClick={handleEndCall}
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  )
}

export default VideoCall
