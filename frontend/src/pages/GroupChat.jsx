import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios.js";
import socket from "../api/socket.js";
import { useAuth } from "../context/useAuth.js";
import Spinner from "../components/Spinner.jsx";

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const GroupChat = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const [groupInfo, setGroupInfo] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [addingUserId, setAddingUserId] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [membersError, setMembersError] = useState("");

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasShownRemovedAlert = useRef(false);

  const fetchGroupMessages = useCallback(async () => {
    setMessagesLoading(true);
    try {
      const response = await api.get(`/messages/group/${groupId}`);
      setMessages(response.data.messages);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403 && !hasShownRemovedAlert.current) {
        hasShownRemovedAlert.current = true;
        alert("You are not a member of this group.");
        navigate("/groups");
      }
    } finally {
      setMessagesLoading(false);
    }
  }, [groupId, navigate]);

  const fetchGroupInfo = useCallback(async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      setGroupInfo(response.data.group);
    } catch (err) {
      console.error(err);
    }
  }, [groupId]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/members`);
      setMembers(response.data.members);
    } catch (err) {
      console.error(err);
    } finally {
      setMembersLoading(false);
    }
  }, [groupId]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const response = await api.get("/auth/users");
      setAllUsers(response.data.users);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGroupMessages();

    fetchGroupInfo();

    socket.connect();
    socket.emit("register", user.id);
    socket.emit("joinGroupRoom", groupId);

    socket.on("receiveGroupMessage", (data) => {
      setMessages((prev) => {
        if (data.id && prev.some((m) => String(m.id) === String(data.id)))
          return prev;
        return [...prev, data];
      });
    });

    socket.on("userGroupTyping", ({ senderId, senderUsername }) => {
      if (senderId === user.id) return;
      setTypingUsers((prev) =>
        prev.some((u) => u.id === senderId)
          ? prev
          : [...prev, { id: senderId, username: senderUsername }],
      );
    });

    socket.on("userGroupStopTyping", ({ senderId }) => {
      setTypingUsers((prev) => prev.filter((u) => u.id !== senderId));
    });

    socket.on("removeGroupMessage", ({ messageId }) => {
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId)),
      );
    });

    socket.on("groupMembersUpdated", () => {
      fetchGroupInfo();
      fetchMembers();
    });

    socket.on("removedFromGroup", ({ groupId: removedGroupId }) => {
      if (String(removedGroupId) === String(groupId)) {
        alert("You have been removed from this group by the admin.");
        navigate("/groups");
      }
    });

    return () => {
      socket.emit("leaveGroupRoom", groupId);
      socket.off("receiveGroupMessage");
      socket.off("userGroupTyping");
      socket.off("userGroupStopTyping");
      socket.off("removeGroupMessage");
      socket.off("groupMembersUpdated");
      socket.off("removedFromGroup");
      socket.disconnect();
    };
  }, [
    groupId,
    user.id,
    fetchGroupMessages,
    fetchGroupInfo,
    fetchMembers,
    navigate,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    socket.emit("groupTyping", {
      senderId: user.id,
      senderUsername: user.username,
      groupId,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("groupStopTyping", { senderId: user.id, groupId });
    }, 1500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      socket.emit("groupStopTyping", { senderId: user.id, groupId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const response = await api.post("/messages/group/send", {
        groupId,
        content: newMessage,
      });

      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(response.data.message.id)))
          return prev;
        return [
          ...prev,
          {
            ...response.data.message,
            senderUsername: user.username,
            username: user.username,
          },
        ];
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

  const openMembers = async () => {
    setShowMembers(true);
    setMembersError("");
    await fetchMembers();
    if (groupInfo?.is_admin) {
      await fetchAllUsers();
    }
  };

  const handleAddMember = async (targetUserId) => {
    setAddingUserId(targetUserId);
    setMembersError("");
    try {
      await api.post(`/groups/${groupId}/members`, { userId: targetUserId });
      await fetchMembers();
    } catch (err) {
      setMembersError(err.response?.data?.error || "Could not add member");
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm("Remove this member from the group?")) return;
    setRemovingUserId(targetUserId);
    setMembersError("");
    try {
      await api.delete(`/groups/${groupId}/members/${targetUserId}`);
      await fetchMembers();
    } catch (err) {
      setMembersError(err.response?.data?.error || "Could not remove member");
    } finally {
      setRemovingUserId(null);
    }
  };

  const memberIds = members.map((m) => m.id);
  const nonMembers = allUsers.filter((u) => !memberIds.includes(u.id));

  return (
    <div className="h-screen flex flex-col bg-gray-50 animate-page-in relative">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/groups"
            className="text-gray-400 hover:text-indigo-600 transition text-sm"
          >
            ← Back
          </Link>
          <h2 className="font-semibold text-gray-800">
            {groupInfo?.name || "Group Chat"}
          </h2>
        </div>
        <button
          onClick={openMembers}
          className="text-sm text-indigo-600 font-medium hover:underline"
        >
          Members
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 max-w-2xl w-full mx-auto">
        {messagesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <svg
              className="w-14 h-14 text-gray-200 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4"
              />
            </svg>
            <p className="font-medium text-gray-500">No messages yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Say hello to the group!
            </p>
          </div>
        ) : (
          <>
            {messages
              .filter(
                (msg, idx, arr) =>
                  !msg.id ||
                  arr.findIndex((m) => String(m.id) === String(msg.id)) === idx,
              )
              .map((msg, index) => {
                const isMe =
                  String(msg.senderId) === String(user.id) ||
                  String(msg.sender_id) === String(user.id);
                const senderName =
                  msg.senderUsername || msg.username || "Unknown";
                const isMenuOpen = menuOpenId === msg.id;
                const timeLabel = formatTime(msg.createdAt || msg.created_at);

                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col animate-message-in w-full ${isMe ? "items-end" : "items-start"}`}
                  >
                    {!isMe && (
                      <span className="text-xs text-gray-400 mb-0.5 ml-1">
                        {senderName}
                      </span>
                    )}
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
                              onClick={() => handleDeleteForEveryone(msg.id)}
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

        {typingUsers.length > 0 && (
          <div className="flex items-start animate-message-in">
            <span className="text-xs text-indigo-500 font-medium bg-indigo-50 px-3 py-1.5 rounded-full">
              {typingUsers.map((u) => u.username).join(", ")}{" "}
              {typingUsers.length === 1 ? "is" : "are"} typing...
            </span>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSendMessage}
        className="p-4 bg-white border-t border-gray-200 flex gap-2 max-w-2xl w-full mx-auto"
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

      {showMembers && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMembers(false)}
          />
          <div className="relative w-full max-w-sm bg-white h-full shadow-xl flex flex-col animate-page-in">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Group Members</h3>
              <button
                onClick={() => setShowMembers(false)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {membersError && (
                <p className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-3">
                  {membersError}
                </p>
              )}

              {membersLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : (
                <div className="flex flex-col gap-2 mb-6">
                  {members.map((m) => {
                    const isThisAdmin =
                      groupInfo && m.id === groupInfo.created_by;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {m.username[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700 block">
                              {m.username}
                            </span>
                            {isThisAdmin && (
                              <span className="text-[10px] text-indigo-500 font-medium">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>

                        {groupInfo?.is_admin &&
                          String(m.id) !== String(user.id) && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              disabled={removingUserId === m.id}
                              className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition disabled:opacity-50"
                            >
                              {removingUserId === m.id ? (
                                <Spinner size="sm" />
                              ) : (
                                "Remove"
                              )}
                            </button>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}

              {groupInfo?.is_admin && (
                <>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                    Add Members
                  </p>
                  {nonMembers.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      Everyone is already in this group
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {nonMembers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-semibold">
                              {u.username[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {u.username}
                            </span>
                          </div>
                          <button
                            onClick={() => handleAddMember(u.id)}
                            disabled={addingUserId === u.id}
                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 transition disabled:opacity-50"
                          >
                            {addingUserId === u.id ? (
                              <Spinner size="sm" />
                            ) : (
                              "Add"
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChat;
