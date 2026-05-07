import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSocket } from "../../socket";

const IncomingCallNotification = ({ callData, onClose }) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 100);

    // Auto-dismiss after 30 seconds
    const autoDismissTimer = setTimeout(() => {
      handleDecline();
    }, 30000);

    return () => {
      clearTimeout(autoDismissTimer);
    };
  }, []);

  const handleAnswer = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      navigate(`/video-call/${callData.callerId}`, {
        state: {
          callId: callData.callId,
          callerName: callData.callerName
        }
      });
    }, 300);
  };

  const handleDecline = () => {
    const socket = getSocket();
    socket.emit('declineCall', {
      callId: callData.callId
    });
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex justify-center px-4 pt-4 pointer-events-none transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg shadow-2xl max-w-md w-full pointer-events-auto border border-gray-700">
        {/* Progress bar for auto-dismiss */}
        <div className="h-1 bg-gray-700 rounded-t-lg overflow-hidden">
          <div
            className="h-full bg-blue-500 animate-shrink-width"
            style={{ animation: 'shrinkWidth 30s linear' }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Caller Avatar */}
            <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-blue-500 animate-pulse">
              <i className="fa-solid fa-video text-blue-400 text-xl"></i>
            </div>

            {/* Call Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white text-lg font-semibold truncate">
                {callData.callerName}
              </h3>
              <p className="text-gray-400 text-sm flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Incoming video call...
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleDecline}
                className="p-3 rounded-full bg-red-600 hover:bg-red-500 transition-all hover:scale-110 active:scale-95"
                aria-label="Decline call"
                title="Decline"
              >
                <i className="fa-solid fa-phone-slash text-white text-lg"></i>
              </button>
              <button
                onClick={handleAnswer}
                className="p-3 rounded-full bg-green-600 hover:bg-green-500 transition-all hover:scale-110 active:scale-95 animate-bounce"
                aria-label="Answer call"
                title="Answer"
              >
                <i className="fa-solid fa-phone text-white text-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add keyframe animation for progress bar */}
      <style>{`
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};

export default IncomingCallNotification;
