import { useState } from "react";
import PropTypes from "prop-types";
import { Send } from "lucide-react";

const GroupSendText = ({ sendMessage, disabled = false, disabledReason = "" }) => {
  const [text, setText] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (disabled) return;
    const next = text.trim();
    if (!next) return;
    try {
      await Promise.resolve(sendMessage(next));
      setText("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[GroupSendText] Failed to send message:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center p-3 bg-black border-t border-gray-800">
      <div className="flex-1 flex items-center bg-white/10 rounded-full border border-gray-700 focus-within:ring-2 focus-within:ring-[#8e79f2]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? disabledReason || "Sending is disabled" : "Type a message..."}
          disabled={disabled}
          className="flex-1 py-3 px-5 bg-white/10 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-[#8e79f2] placeholder-gray-400 border border-gray-700"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className={`ml-3 p-3 rounded-full ${
          !disabled && text.trim()
            ? "bg-indigo-700 text-white hover:bg-[#8e79f2]"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        } transition-colors`}
        title={disabled ? disabledReason || "Sending is disabled" : "Send"}
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  );
};

GroupSendText.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  disabledReason: PropTypes.string,
};

export default GroupSendText;

