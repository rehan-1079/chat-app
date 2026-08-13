import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import socket from "../api/socket.js";
import { useAuth } from "../context/useAuth.js";
import Spinner from "../components/Spinner.jsx";

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const Chat = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/auth/users");
      setUsers(response.data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (otherUserId) => {
    setMessagesLoading(true);
    try {
      const response = await api.get(`/messages/${otherUserId}`);
      setMessages(response.data.messages);
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();

    socket.connect();
    socket.emit("register", user.id);

    socket.on("receiveMessage", (data) => {
      setMessages((prev) => {
        if (data.id && prev.some((m) => String(m.id) === String(data.id)))
          return prev;
        return [...prev, data];
      });
    });

    socket.on("onlineUsersUpdate", (onlineIds) => {
      setOnlineUserIds(onlineIds);
    });

    socket.on("userTyping", ({ senderId }) => {
      setSelectedUser((current) => {
        if (current && senderId === current.id) {
          setIsTyping(true);
        }
        return current;
      });
    });

    socket.on("userStopTyping", ({ senderId }) => {
      setSelectedUser((current) => {
        if (current && senderId === current.id) {
          setIsTyping(false);
        }
        return current;
      });
    });

    socket.on("removeMessage", ({ messageId }) => {
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId)),
      );
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("onlineUsersUpdate");
      socket.off("userTyping");
      socket.off("userStopTyping");
      socket.off("removeMessage");
      socket.disconnect();
    };
  }, [user.id, fetchUsers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTyping(false);
    setMenuOpenId(null);
    if (selectedUser) {
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!selectedUser) return;

    socket.emit("typing", { senderId: user.id, receiverId: selectedUser.id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", {
        senderId: user.id,
        receiverId: selectedUser.id,
      });
    }, 1500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    setSending(true);
    try {
      socket.emit("stopTyping", {
        senderId: user.id,
        receiverId: selectedUser.id,
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const response = await api.post("/messages/send", {
        receiverId: selectedUser.id,
        content: newMessage,
      });

      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(response.data.message.id)))
          return prev;
        return [...prev, response.data.message];
      });
      setNewMessage("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteForEveryone = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}/everyone`);
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId)),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setMenuOpenId(null);
    }
  };

  const handleDeleteForMe = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}/me`);
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId)),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setMenuOpenId(null);
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 animate-page-in overflow-hidden">
      <div
        className={`${selectedUser ? "hidden md:flex" : "flex"} w-full md:w-72 bg-white border-r border-gray-200 flex-col`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
              {user.username[0].toUpperCase()}
            </div>
            <span className="font-semibold text-gray-800">{user.username}</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-red-500 transition"
          >
            Logout
          </button>
        </div>

        <Link
          to="/groups"
          className="mx-4 mt-4 mb-2 text-center bg-indigo-50 text-indigo-600 font-medium text-sm py-2 rounded-lg hover:bg-indigo-100 transition"
        >
          Go to Groups
        </Link>

        <div className="flex-1 overflow-y-auto px-2 mt-2">
          <p className="text-xs font-semibold text-gray-400 px-2 mb-1 uppercase tracking-wide">
            Users
          </p>

          {usersLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-400 px-2">No other users yet</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                  selectedUser?.id === u.id
                    ? "bg-indigo-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="relative">
                  <div className="w-9 h-9 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {u.username[0].toUpperCase()}
                  </div>
                  {onlineUserIds.includes(u.id) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {u.username}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className={`${selectedUser ? "flex" : "hidden md:flex"} flex-1 flex-col`}
      >
        {selectedUser ? (
          <>
            <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="md:hidden text-gray-400 hover:text-indigo-600 transition text-lg leading-none"
              >
                ←
              </button>
              <div className="relative">
                <div className="w-9 h-9 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {selectedUser.username[0].toUpperCase()}
                </div>
                {onlineUserIds.includes(selectedUser.id) && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div>
                <span className="font-semibold text-gray-800 block">
                  {selectedUser.username}
                </span>
                <span className="text-xs">
                  {isTyping ? (
                    <span className="text-indigo-500 font-medium">
                      typing...
                    </span>
                  ) : onlineUserIds.includes(selectedUser.id) ? (
                    <span className="text-gray-400">Online</span>
                  ) : (
                    <span className="text-gray-400">Offline</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {messagesLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : (
                <>
                  {messages
                    .filter(
                      (msg, idx, arr) =>
                        !msg.id ||
                        arr.findIndex(
                          (m) => String(m.id) === String(msg.id),
                        ) === idx,
                    )
                    .map((msg, index) => {
                      const isMe =
                        String(msg.senderId) === String(user.id) ||
                        String(msg.sender_id) === String(user.id);
                      const isMenuOpen = menuOpenId === msg.id;
                      const timeLabel = formatTime(
                        msg.createdAt || msg.created_at,
                      );

                      return (
                        <div
                          key={msg.id || index}
                          className={`flex flex-col animate-message-in w-full ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`flex items-center gap-2 relative ${isMe ? "flex-row-reverse" : ""}`}
                          >
                            {msg.id && (
                              <button
                                onClick={() =>
                                  setMenuOpenId(isMenuOpen ? null : msg.id)
                                }
                                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-base px-1.5 py-0.5 rounded transition self-center shrink-0"
                                title="Message options"
                              >
                                ⋮
                              </button>
                            )}

                            <div
                              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                            >
                              <span
                                className={`px-4 py-2 rounded-2xl max-w-xs wrap-break-word text-sm ${
                                  isMe
                                    ? "bg-indigo-600 text-white rounded-br-sm"
                                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                                }`}
                              >
                                {msg.content}
                              </span>
                              {timeLabel && (
                                <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                                  {timeLabel}
                                </span>
                              )}
                            </div>

                            {isMenuOpen && (
                              <div
                                className={`absolute top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm ${
                                  isMe ? "right-0" : "left-0"
                                }`}
                              >
                                <button
                                  onClick={() => handleDeleteForMe(msg.id)}
                                  className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 whitespace-nowrap"
                                >
                                  Delete for me
                                </button>
                                {isMe && (
                                  <button
                                    onClick={() =>
                                      handleDeleteForEveryone(msg.id)
                                    }
                                    className="block w-full text-left px-4 py-2 hover:bg-red-50 text-red-500 whitespace-nowrap"
                                  >
                                    Delete for everyone
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-white border-t border-gray-200 flex gap-2"
            >
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={sending}
                className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-16"
              >
                {sending ? <Spinner size="sm" /> : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex-col items-center justify-center text-gray-400 hidden md:flex">
            <svg
              className="w-16 h-16 text-gray-200 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="font-medium text-gray-500">
              Select a user to start chatting
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Your conversations will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
