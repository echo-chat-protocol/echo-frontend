import PropTypes from "prop-types";
import {
  PhoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  ClockIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon
} from '@heroicons/react/24/solid';

const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return null;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const CallEventMessage = ({ callData, currentUserId }) => {
  const { status, callType = 'video', duration = 0, callerId, receiverId } = callData;

  const isOutgoing = callerId === currentUserId;
  const isVideo = callType === 'video';

  // Determine icon and styling based on call status
  const getCallConfig = () => {
    switch (status) {
      case 'ended':
        return {
          icon: isVideo ? VideoCameraIcon : PhoneIcon,
          bgColor: 'bg-green-900/40',
          borderColor: 'border-green-600/50',
          iconColor: 'text-green-400',
          textColor: 'text-green-300',
          label: isOutgoing ? 'Outgoing call' : 'Incoming call',
        };
      case 'declined':
        return {
          icon: isVideo ? VideoCameraSlashIcon : PhoneXMarkIcon,
          bgColor: 'bg-red-900/40',
          borderColor: 'border-red-600/50',
          iconColor: 'text-red-400',
          textColor: 'text-red-300',
          label: isOutgoing ? 'Call declined' : 'Declined call',
        };
      case 'missed':
        return {
          icon: isVideo ? VideoCameraSlashIcon : PhoneXMarkIcon,
          bgColor: 'bg-yellow-900/40',
          borderColor: 'border-yellow-600/50',
          iconColor: 'text-yellow-400',
          textColor: 'text-yellow-300',
          label: isOutgoing ? 'Missed call' : 'You missed a call',
        };
      default:
        return {
          icon: isVideo ? VideoCameraIcon : PhoneIcon,
          bgColor: 'bg-blue-900/40',
          borderColor: 'border-blue-600/50',
          iconColor: 'text-blue-400',
          textColor: 'text-blue-300',
          label: isOutgoing ? 'Calling...' : 'Incoming call',
        };
    }
  };

  const config = getCallConfig();
  const CallIcon = config.icon;
  const durationText = formatDuration(duration);

  // Get direction icon
  const DirectionIcon = isOutgoing ? ArrowUpRightIcon : ArrowDownLeftIcon;

  return (
    <div className="flex justify-center my-2">
      <div
        className={`${config.bgColor} ${config.borderColor} ${config.textColor}
          border px-4 py-2.5 rounded-lg flex items-center space-x-3 min-w-[200px] max-w-sm`}
      >
        {/* Direction and Call Type Icons */}
        <div className="relative flex-shrink-0">
          <CallIcon className={`h-5 w-5 ${config.iconColor}`} />
          <DirectionIcon
            className={`h-3 w-3 ${config.iconColor} absolute -bottom-0.5 -right-0.5 bg-gray-900 rounded-full p-0.5`}
            title={isOutgoing ? "Outgoing" : "Incoming"}
          />
        </div>

        <div className="flex-1 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {config.label}
            </span>
            {durationText && (
              <div className="flex items-center space-x-1 mt-0.5">
                <ClockIcon className={`h-3 w-3 ${config.iconColor}`} />
                <span className="text-xs opacity-90">
                  {durationText}
                </span>
              </div>
            )}
          </div>

          {!durationText && status === 'ended' && (
            <span className="text-xs opacity-70">No answer</span>
          )}
        </div>
      </div>
    </div>
  );
};

CallEventMessage.propTypes = {
  callData: PropTypes.shape({
    status: PropTypes.oneOf(['ringing', 'in-progress', 'declined', 'ended', 'missed']).isRequired,
    callType: PropTypes.string,
    duration: PropTypes.number,
    callerId: PropTypes.string.isRequired,
    receiverId: PropTypes.string.isRequired,
  }).isRequired,
  currentUserId: PropTypes.string.isRequired,
};

export default CallEventMessage;
