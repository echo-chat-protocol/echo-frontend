import PropTypes from "prop-types";
import { formatProfileImage } from "../utils/helpers";

const GroupListItem = ({ group, isActive, onSelect, unreadCount = 0 }) => {
  const name = group?.name || "Unnamed group";
  const subtitle = group?.lastActivityText || "";
  const time = group?.lastActivityAt || group?.createdAt || group?.joinedAt || null;
  const avatarSrc = formatProfileImage(group?.profilePicture, name);

  return (
    <li
      className={`p-3 hover:bg-[#8e79f2]/20 cursor-pointer transition-colors ${
        isActive ? "bg-[#8e79f2]/20" : unreadCount > 0 ? "bg-[#8e79f2]/10" : ""
      }`}
      onClick={() => onSelect(group)}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <img
            src={avatarSrc}
            alt={name}
            className="w-10 h-10 rounded-full border-2 border-black object-cover bg-gray-700"
            onError={(e) => {
              e.target.src = formatProfileImage("", name);
            }}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <p className={`text-white truncate ${unreadCount > 0 ? "font-bold" : "font-medium"}`}>{name}</p>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>
          <p className={`text-sm truncate ${unreadCount > 0 ? "text-white font-semibold" : "text-gray-400"}`}>
            {subtitle ? (subtitle.length > 30 ? `${subtitle.substring(0, 30)}...` : subtitle) : "No messages yet"}
          </p>
        </div>
      </div>
    </li>
  );
};

GroupListItem.propTypes = {
  group: PropTypes.object.isRequired,
  isActive: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  unreadCount: PropTypes.number,
};

export default GroupListItem;

