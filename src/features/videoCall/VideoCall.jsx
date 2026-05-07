import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { getSocket } from '../../socket';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC3dqQgY1dEE4F2Cdb6zv0rQRcC91CxZVo",
  authDomain: "webrtc-app-a0607.firebaseapp.com",
  projectId: "webrtc-app-a0607",
  storageBucket: "webrtc-app-a0607.firebasestorage.app",
  messagingSenderId: "429607886523",
  appId: "1:429607886523:web:df9c41d3e8c69cf746939e",
  measurementId: "G-WSBW8BK3P4"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const VideoCall = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { odebukiUserId } = useParams();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callIdRef = useRef('');
  const recognitionRef = useRef(null);
  const captionThrottleRef = useRef({ lastText: '', lastSentAt: 0 });
  const captionsRestartGateRef = useRef({ blockedUntil: 0 });
  const remoteCaptionClearTimeoutRef = useRef(null);
  const captionsStateRef = useRef({
    captionsEnabled: false,
    callStatus: 'idle',
    isMuted: false,
    hasAudioPermission: true,
  });

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callId, setCallId] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [hasAudioPermission, setHasAudioPermission] = useState(true);
  const [hasVideoPermission, setHasVideoPermission] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [localUserProfile, setLocalUserProfile] = useState(null);
  const [remoteUserProfile, setRemoteUserProfile] = useState(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionsSupported, setCaptionsSupported] = useState(true);
  const [remoteCaption, setRemoteCaption] = useState('');
  const [remoteCaptionIsFinal, setRemoteCaptionIsFinal] = useState(false);
  const [remoteCaptionSpeaker, setRemoteCaptionSpeaker] = useState('');
  const [localCaption, setLocalCaption] = useState('');
  const [localCaptionIsFinal, setLocalCaptionIsFinal] = useState(false);

  const hasStartedCallRef = useRef(false);

  // Check if we're answering a call (came from notification)
  const isAnswering = location.state?.callId;
  const callerName = location.state?.callerName;

  // Fetch user profiles
  useEffect(() => {
    const fetchProfiles = () => {
      const socket = getSocket();
      const username = localStorage.getItem('username');
      const userId = localStorage.getItem('userId');

      // Get local user profile from localStorage using the correct key pattern
      const storedProfile = localStorage.getItem(`profile-${userId}`);
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile);
          setLocalUserProfile({
            username: profile.username || username,
            profileImage: profile.profilePicture || profile.profileImage || null
          });
        } catch (e) {
          console.error('Error parsing stored profile:', e);
        }
      } else {
        // Fallback to just username
        setLocalUserProfile({
          username: username || 'You',
          profileImage: null
        });
      }

      // Fetch remote user profile via socket - ALWAYS prefer fresh data from server
      socket.emit('fetchUsername', odebukiUserId, (response) => {
        if (response) {
          // Backend might send profilePicture or profileImage
          let profilePic = response.profilePicture || response.profileImage || null;

          // If socket doesn't return profile picture, check localStorage as fallback
          if (!profilePic) {
            const cachedProfile = localStorage.getItem(`profile-${odebukiUserId}`);
            if (cachedProfile) {
              try {
                const parsed = JSON.parse(cachedProfile);
                profilePic = parsed.profilePicture || parsed.profileImage || null;
              } catch (e) {
                console.error('Error parsing cached profile:', e);
              }
            }
          }

          setRemoteUserProfile({
            username: response.username || 'User',
            profileImage: profilePic
          });

          // Update localStorage cache with data from server (keep cached pic if server doesn't have one)
          localStorage.setItem(`profile-${odebukiUserId}`, JSON.stringify({
            username: response.username,
            profilePicture: profilePic
          }));
        } else {
          console.error('❌ fetchUsername returned no response');
        }
      });
    };

    fetchProfiles();
  }, [odebukiUserId]);

  // Listen for profile updates (both local and remote users)
  useEffect(() => {
    const socket = getSocket();

    // Handle local user profile updates
    const handleLocalProfileUpdate = () => {
      const username = localStorage.getItem('username');
      const userId = localStorage.getItem('userId');
      const storedProfile = localStorage.getItem(`profile-${userId}`);

      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile);
          setLocalUserProfile({
            username: profile.username || username,
            profileImage: profile.profilePicture || profile.profileImage || null
          });
        } catch (e) {
          console.error('Error updating local profile:', e);
        }
      }
    };

    // Handle remote user profile updates via socket
    const handleRemoteProfileUpdate = (data) => {
      const { userId: updatedUserId, username, profilePicture } = data;

      // Check if this is the remote user we're calling
      if (updatedUserId === odebukiUserId) {
        setRemoteUserProfile({
          username: username || 'User',
          profileImage: profilePicture || null
        });

        // Also update localStorage cache
        const cachedProfile = localStorage.getItem(`profile-${updatedUserId}`);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            localStorage.setItem(`profile-${updatedUserId}`, JSON.stringify({
              ...parsed,
              username: username || parsed.username,
              profilePicture: profilePicture
            }));
          } catch (e) {
            console.error('Error updating cached profile:', e);
          }
        }
      }
    };

    window.addEventListener('profileUpdated', handleLocalProfileUpdate);
    socket.on('userProfileUpdated', handleRemoteProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleLocalProfileUpdate);
      socket.off('userProfileUpdated', handleRemoteProfileUpdate);
    };
  }, [odebukiUserId]);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = !!SpeechRecognition;
    setCaptionsSupported(supported);
    if (!supported) setCaptionsEnabled(false);
  }, []);

  useEffect(() => {
    captionsStateRef.current = {
      captionsEnabled,
      callStatus,
      isMuted,
      hasAudioPermission,
    };
  }, [captionsEnabled, callStatus, isMuted, hasAudioPermission]);

  const stopCaptionsRecognition = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  };

  const startCaptionsRecognition = ({ isUserGesture } = { isUserGesture: false }) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (recognitionRef.current) return;

    const state = captionsStateRef.current;
    const canRun =
      state.captionsEnabled &&
      state.callStatus === 'connected' &&
      !state.isMuted &&
      state.hasAudioPermission;

    if (!canRun) return;

    const socket = getSocket();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    const sendCaption = (eventName, text) => {
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) return;
      socket.emit(eventName, {
        targetUserId: odebukiUserId,
        callId: callIdRef.current,
        text: trimmed,
      });
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript || '';
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }

      const now = Date.now();
      const interimTrimmed = interim.trim();
      if (interimTrimmed) {
        setLocalCaption(interimTrimmed);
        setLocalCaptionIsFinal(false);

        const { lastText, lastSentAt } = captionThrottleRef.current;
        const isDifferent = interimTrimmed !== lastText;
        const isThrottledOk = now - lastSentAt >= 250;
        if (isDifferent && isThrottledOk) {
          captionThrottleRef.current = { lastText: interimTrimmed, lastSentAt: now };
          sendCaption('captionInterim', interimTrimmed);
        }
      }

      const finalTrimmed = finalText.trim();
      if (finalTrimmed) {
        setLocalCaption(finalTrimmed);
        setLocalCaptionIsFinal(true);
        captionThrottleRef.current = { lastText: '', lastSentAt: now };
        sendCaption('captionFinal', finalTrimmed);

        setTimeout(() => {
          setLocalCaption('');
          setLocalCaptionIsFinal(false);
        }, 4500);
      }
    };

    recognition.onerror = (e) => {
      const err = e?.error || e;

      // Prevent tight restart loops on certain errors (notably "aborted").
      if (err === 'aborted') {
        captionsRestartGateRef.current.blockedUntil = Date.now() + 5000;
        stopCaptionsRecognition();
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const next = captionsStateRef.current;
      const shouldRestart =
        next.captionsEnabled &&
        next.callStatus === 'connected' &&
        !next.isMuted &&
        next.hasAudioPermission;
      if (!shouldRestart) return;

      setTimeout(() => {
        if (Date.now() < captionsRestartGateRef.current.blockedUntil) return;
        const again = captionsStateRef.current;
        const restartOk =
          again.captionsEnabled &&
          again.callStatus === 'connected' &&
          !again.isMuted &&
          again.hasAudioPermission;
        if (!restartOk) return;
        if (recognitionRef.current) return;
        startCaptionsRecognition({ isUserGesture: false });
      }, 250);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      // Some browsers require this to be triggered by a user gesture.
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    const socket = getSocket();

    const handleCaptionInterim = (payload) => {
      if (!payload) return;
      if (payload.callId && callIdRef.current && payload.callId !== callIdRef.current) return;
      setRemoteCaptionSpeaker(payload.fromUsername || remoteUserProfile?.username || '');
      setRemoteCaption(payload.text || '');
      setRemoteCaptionIsFinal(false);
      if (remoteCaptionClearTimeoutRef.current) {
        clearTimeout(remoteCaptionClearTimeoutRef.current);
        remoteCaptionClearTimeoutRef.current = null;
      }
    };

    const handleCaptionFinal = (payload) => {
      if (!payload) return;
      if (payload.callId && callIdRef.current && payload.callId !== callIdRef.current) return;
      setRemoteCaptionSpeaker(payload.fromUsername || remoteUserProfile?.username || '');
      setRemoteCaption(payload.text || '');
      setRemoteCaptionIsFinal(true);

      if (remoteCaptionClearTimeoutRef.current) {
        clearTimeout(remoteCaptionClearTimeoutRef.current);
      }
      remoteCaptionClearTimeoutRef.current = setTimeout(() => {
        setRemoteCaption('');
        setRemoteCaptionIsFinal(false);
        remoteCaptionClearTimeoutRef.current = null;
      }, 4500);
    };

    socket.on('captionInterim', handleCaptionInterim);
    socket.on('captionFinal', handleCaptionFinal);

    return () => {
      socket.off('captionInterim', handleCaptionInterim);
      socket.off('captionFinal', handleCaptionFinal);
      if (remoteCaptionClearTimeoutRef.current) {
        clearTimeout(remoteCaptionClearTimeoutRef.current);
        remoteCaptionClearTimeoutRef.current = null;
      }
    };
  }, [remoteUserProfile?.username]);

  useEffect(() => {
    const shouldRun =
      captionsEnabled &&
      captionsSupported &&
      callStatus === 'connected' &&
      !isMuted &&
      hasAudioPermission;

    if (!shouldRun) {
      stopCaptionsRecognition();
      return;
    }

    // Intentionally do not auto-start; start requires a user gesture in some browsers.
  }, [captionsEnabled, captionsSupported, callStatus, isMuted, hasAudioPermission]);

  useEffect(() => {
    const socket = getSocket();

    // Initialize peer connection
    pcRef.current = new RTCPeerConnection(servers);
    remoteStreamRef.current = new MediaStream();

    const startCamera = async () => {
      if (hasStartedCallRef.current) return;
      hasStartedCallRef.current = true;

      try {
        // Try to get both video and audio
        let mediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          setHasAudioPermission(true);
          setHasVideoPermission(true);
        } catch (error) {
          // Try video only
          let videoStream = null;
          try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setHasVideoPermission(true);
          } catch (videoError) {
            setHasVideoPermission(false);
            setIsCameraOff(true);
          }

          // Try audio only
          let audioStream = null;
          try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setHasAudioPermission(true);
          } catch (audioError) {
            setHasAudioPermission(false);
            setIsMuted(true);
          }

          // Combine streams
          mediaStream = new MediaStream();
          if (videoStream) {
            videoStream.getTracks().forEach(track => mediaStream.addTrack(track));
          }
          if (audioStream) {
            audioStream.getTracks().forEach(track => mediaStream.addTrack(track));
          }

          // If neither permission granted, throw error
          if (!videoStream && !audioStream) {
            throw new Error('No media permissions granted');
          }
        }

        localStreamRef.current = mediaStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        // Push tracks from local stream to peer connection
        mediaStream.getTracks().forEach((track) => {
          pcRef.current.addTrack(track, mediaStream);
        });

        // Pull tracks from remote stream, add to video stream
        pcRef.current.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStreamRef.current.addTrack(track);

            // Listen for track enabled/disabled events
            track.onended = () => {};

            // Monitor remote video track state
            if (track.kind === 'video') {
              track.onmute = () => setRemoteVideoEnabled(false);
              track.onunmute = () => setRemoteVideoEnabled(true);
            }
          });
        };

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }

        // If answering a call, automatically answer
        if (isAnswering) {
          setCallId(location.state.callId);
          setTimeout(() => {
            handleAnswerCall(location.state.callId);
            socket.emit('acceptCall', { callId: location.state.callId });

          }, 500);
        } else {
          // If initiating a call, create offer and notify the target user
          handleCreateCall();
        }
      } catch (error) {
        console.error("Error accessing camera/microphone:", error);
        alert("Could not access camera or microphone. The call will start without media.");
        // Continue with call even without permissions
        if (isAnswering) {
          setCallId(location.state.callId);
          setTimeout(() => {
            handleAnswerCall(location.state.callId);
            socket.emit('acceptCall', { callId: location.state.callId });
          }, 500);
        } else {
          handleCreateCall();
        }
      }
    };

    // Wait for socket to connect then start camera
    const initCall = () => {
      startCamera();
    };

    if (socket.connected) {
      initCall();
    } else {
      socket.on('connect', initCall);
    }

    // Helper to stop all media
    const stopMedia = () => {
      // Stop all tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        localStreamRef.current = null;
      }
      // Clear video element sources
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current = null;
      }
      // Close peer connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };

    // Listen for call declined
    socket.on('callDeclined', () => {
      alert('Call was declined');
      stopMedia();
      navigate(-1);
    });

    // Listen for call ended by other user
    socket.on('callEnded', () => {
      stopMedia();
      navigate(-1);
    });

    // Listen for remote video state changes
    socket.on('videoStateChanged', ({ isEnabled }) => {
      setRemoteVideoEnabled(isEnabled);
    });

    // Listen for remote audio state changes (optional, for future UI indicators)
    socket.on('audioStateChanged', ({ isEnabled }) => {
      // Could add a state variable to show muted indicator on remote user
    });

    return () => {
      stopMedia();
      socket.off('connect', initCall);
      socket.off('callDeclined');
      socket.off('callEnded');
      socket.off('videoStateChanged');
      socket.off('audioStateChanged');
    };
  }, [navigate]);

  // Create a call (caller)
  const handleCreateCall = async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    const socket = getSocket();
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    setCallId(callDoc.id);
    setCallStatus('calling');

    // Get candidates for caller, save to db
    pcRef.current.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    // Create offer
    const offerDescription = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await callDoc.set({ offer });

    // Send call notification to target user via socket
    socket.emit('initiateCall', {
      targetUserId: odebukiUserId,
      callId: callDoc.id,
    });

    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pcRef.current.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pcRef.current.setRemoteDescription(answerDescription);
        setCallStatus('connected');
      }
    });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pcRef.current.addIceCandidate(candidate);
        }
      });
    });

    setIsInCall(true);
  };

  // Answer a call (callee)
  const handleAnswerCall = async (incomingCallId) => {
    const callIdToUse = incomingCallId || callId;
    if (!callIdToUse || !pcRef.current) return;

    const callDoc = firestore.collection('calls').doc(callIdToUse);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');

    pcRef.current.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();

    if (!callData) {
      alert("Call not found!");
      return;
    }

    const offerDescription = callData.offer;
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          pcRef.current.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    setIsInCall(true);
    setCallStatus('connected');
  };

  const handleEndCall = () => {
    const socket = getSocket();

    // Notify the other user
    socket.emit('endCall', { callId });
    
    // Stop all media tracks (camera and microphone)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
      
    }

    // Clear video element sources
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop captions
    if (recognitionRef.current) {
      stopCaptionsRecognition();
    }

    navigate(-1);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMutedState = !isMuted;
        audioTracks.forEach(track => {
          track.enabled = !newMutedState;
        });
        setIsMuted(newMutedState);

        // Notify remote user about audio state change
        const socket = getSocket();
        socket.emit('audioStateChanged', {
          targetUserId: odebukiUserId,
          isEnabled: !newMutedState
        });
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newCameraOffState = !isCameraOff;
        videoTracks.forEach(track => {
          track.enabled = !newCameraOffState;
        });
        setIsCameraOff(newCameraOffState);

        // Notify remote user about video state change
        const socket = getSocket();
        socket.emit('videoStateChanged', {
          targetUserId: odebukiUserId,
          isEnabled: !newCameraOffState
        });
      }
    }
  };

  // Helper function for consistent avatar colors
  const getConsistentColor = (username) => {
    const colors = ['FF5733', '33FF57', '3357FF', 'F033FF', 'FF33F0'];
    return colors[username.length % colors.length];
  };

  // Get profile image with fallback
  const getProfileImage = (profile) => {
    if (!profile) return null;

    // Check if profile has a custom image (not empty string, null, or undefined)
    const hasCustomImage = profile.profileImage && profile.profileImage.trim().length > 0;

    let imageUrl;
    if (hasCustomImage) {
      // If the path starts with /, prepend the backend URL
      imageUrl = profile.profileImage.startsWith('/')
        ? `http://localhost:3001${profile.profileImage}`
        : profile.profileImage;
    } else {
      // Fallback to UI Avatars
      imageUrl = `https://ui-avatars.com/api/?name=${profile.username}&background=${getConsistentColor(profile.username)}&color=fff`;
    }

    return imageUrl;
  };

  return (
    <div className="h-[100dvh] bg-black flex flex-col overflow-hidden">
      {/* Video area */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
        {/* Remote video */}
        <div className="w-full h-full min-h-0 bg-gray-900 flex flex-col relative overflow-hidden">
          <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${!remoteVideoEnabled && callStatus === 'connected' ? 'hidden' : ''}`}
            />
          {callStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {remoteUserProfile ? (
                <>
                  <img
                    src={getProfileImage(remoteUserProfile)}
                    alt={remoteUserProfile.username}
                    className="w-48 h-48 rounded-full object-cover mb-4"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${remoteUserProfile.username}&background=${getConsistentColor(remoteUserProfile.username)}&color=fff`;
                    }}
                  />
                  <p className="text-white text-xl">{remoteUserProfile.username}</p>
                </>
              ) : (
                <i className="fa-solid fa-user text-gray-600 text-9xl"></i>
              )}
            </div>
          )}
          {callStatus === 'connected' && !remoteVideoEnabled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
              {remoteUserProfile ? (
                <>
                  <img
                    src={getProfileImage(remoteUserProfile)}
                    alt={remoteUserProfile.username}
                    className="w-48 h-48 rounded-full object-cover mb-4"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${remoteUserProfile.username}&background=${getConsistentColor(remoteUserProfile.username)}&color=fff`;
                    }}
                  />
                  <p className="text-white text-xl">{remoteUserProfile.username}</p>
                </>
              ) : (
                <i className="fa-solid fa-user text-gray-600 text-9xl"></i>
              )}
            </div>
          )}

          </div>

          {callStatus === 'connected' && captionsEnabled && remoteCaption && (
            <div className="shrink-0 px-4 py-2 bg-black/60 border-t border-white/10">
              <p className={`text-white text-base leading-snug ${remoteCaptionIsFinal ? '' : 'opacity-80'}`}>
                {(remoteCaptionSpeaker || remoteUserProfile?.username || 'Remote')}: {remoteCaption}
              </p>
            </div>
          )}
        </div>

        {/* Local video (small overlay) */}
        <div className="absolute bottom-4 right-4 w-64 h-48 bg-gray-800 rounded-lg border-2 border-gray-700 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isCameraOff || !hasVideoPermission ? 'hidden' : ''}`}
            />
            {(isCameraOff || !hasVideoPermission) && (() => {
              return (
                <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-800">
                  {localUserProfile ? (
                    <>
                      <img
                        src={getProfileImage(localUserProfile)}
                        alt={localUserProfile.username}
                        className="w-24 h-24 rounded-full object-cover mb-2"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${localUserProfile.username}&background=${getConsistentColor(localUserProfile.username)}&color=fff`;
                        }}
                      />
                      <p className="text-white text-sm">{localUserProfile.username}</p>
                    </>
                  ) : (
                    <i className="fa-solid fa-user text-gray-500 text-2xl"></i>
                  )}
                </div>
              );
            })()}
          </div>

          {callStatus === 'connected' && captionsEnabled && localCaption && (
            <div className="shrink-0 px-2 py-1 bg-black/60 border-t border-white/10">
              <p className={`text-white text-xs leading-snug ${localCaptionIsFinal ? '' : 'opacity-80'}`}>
                {(localUserProfile?.username || localStorage.getItem('username') || 'You')}: {localCaption}
              </p>
            </div>
          )}
        </div>

        {/* Call status */}
        {callStatus === 'calling' && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 p-4 rounded-lg">
            <p className="text-white text-sm">Calling...</p>
          </div>
        )}

        {callStatus === 'connected' && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-800 p-2 rounded-lg">
            <p className="text-white text-sm">Connected</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4 flex justify-center gap-4 shrink-0">
        <button
          className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}
          aria-label="Toggle microphone"
          onClick={toggleMute}
        >
          <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-xl`}></i>
        </button>

        <button
          className={`p-4 rounded-full transition-colors ${isCameraOff ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}
          aria-label="Toggle camera"
          onClick={toggleCamera}
        >
          <i className={`fa-solid ${isCameraOff ? 'fa-video-slash' : 'fa-video'} text-white text-xl`}></i>
        </button>

        <button
          className={`p-4 rounded-full transition-colors ${captionsEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 hover:bg-gray-700'} ${!captionsSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Toggle captions"
          onClick={() => {
            if (!captionsSupported) return;
            const next = !captionsEnabled;
            setCaptionsEnabled(next);
            captionsStateRef.current.captionsEnabled = next;
            if (next) captionsRestartGateRef.current.blockedUntil = 0;
            setRemoteCaption('');
            setRemoteCaptionIsFinal(false);
            setRemoteCaptionSpeaker('');
            setLocalCaption('');
            setLocalCaptionIsFinal(false);

            if (next) startCaptionsRecognition({ isUserGesture: true });
            else stopCaptionsRecognition();
          }}
          title={captionsSupported ? (captionsEnabled ? 'Captions on' : 'Captions off') : 'Captions not supported in this browser'}
        >
          <i className="fa-solid fa-closed-captioning text-white text-xl"></i>
        </button>

        <button
          className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
          aria-label="End call"
          onClick={handleEndCall}
        >
          <i className="fa-solid fa-phone-slash text-white text-xl"></i>
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
