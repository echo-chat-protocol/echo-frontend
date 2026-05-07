import PropTypes from "prop-types";
import GroupListItem from "./GroupListItem";

const GroupList = ({ groups, activeChat, onSelect, unreadByGroupId = {} }) => {
  return (
    <ul className="divide-y divide-gray-700">
      {groups.map((g) => (
        <GroupListItem
          key={g.groupId}
          group={g}
          isActive={activeChat?.type === "group" && String(activeChat.groupId) === String(g.groupId)}
          onSelect={onSelect}
          unreadCount={unreadByGroupId[String(g.groupId)] || 0}
        />
      ))}
    </ul>
  );
};

GroupList.propTypes = {
  groups: PropTypes.array.isRequired,
  activeChat: PropTypes.object,
  onSelect: PropTypes.func.isRequired,
  unreadByGroupId: PropTypes.object,
};

export default GroupList;
