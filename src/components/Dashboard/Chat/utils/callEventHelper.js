/**
 * Helper function to create and emit call event messages
 * This should be called from the VideoCall component when call events occur
 */

export const createCallEventMessage = ({
  socket,
  callData,
  currentUserId,
  targetUserId,
  encrypt
}) => {
  const callEventMessage = {
    messageType: 'call_event',
    callData: {
      status: callData.status, // 'ringing', 'in-progress', 'declined', 'ended', 'missed'
      callType: callData.callType || 'video',
      duration: callData.duration || 0,
      callerId: callData.callerId,
      receiverId: callData.receiverId,
      callId: callData.callId,
    },
    userId: currentUserId,
    targetUserId: targetUserId,
    createdAt: new Date().toISOString(),
    text: '', // Empty text for call events
    image: null,
  };

  // If encryption function is provided, encrypt the message
  // Otherwise, send as plaintext (you should integrate encryption)
  if (encrypt) {
    const encrypted = encrypt(JSON.stringify(callEventMessage.callData));
    socket.emit('sendMessage', {
      ...callEventMessage,
      payload: encrypted.payload,
      publicEphemeralKey: encrypted.publicEphemeralKey,
    });
  } else {
    // For testing without encryption
    socket.emit('sendMessage', callEventMessage);
  }

  return callEventMessage;
};

/**
 * Example usage in VideoCall.jsx:
 *
 * import { createCallEventMessage } from '../Dashboard/Chat/utils/callEventHelper';
 *
 * // When call ends
 * const handleEndCall = () => {
 *   const callDuration = calculateDuration(callStartTime);
 *
 *   createCallEventMessage({
 *     socket: getSocket(),
 *     callData: {
 *       status: 'ended',
 *       callType: 'video',
 *       duration: callDuration,
 *       callerId: localStorage.getItem('userId'),
 *       receiverId: odebukiUserId,
 *       callId: callId,
 *     },
 *     currentUserId: localStorage.getItem('userId'),
 *     targetUserId: odebukiUserId,
 *   });
 *
 *   // ... rest of end call logic
 * };
 */
