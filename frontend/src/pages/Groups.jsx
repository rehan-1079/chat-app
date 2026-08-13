import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios.js";
import socket from "../api/socket.js";
import { useAuth } from "../context/useAuth.js";
import Spinner from "../components/Spinner.jsx";

const Groups = () => {
  const { logout } = useAuth();
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const navigate = useNavigate();

  const fetchGroups = useCallback(async () => {
    try {
      const response = await api.get("/groups");
      setGroups(response.data.groups);
    } catch (err) {
      console.error(err);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGroups();

    socket.connect();

    socket.on("groupsUpdated", () => {
      fetchGroups();
    });

    return () => {
      socket.off("groupsUpdated");
      socket.disconnect();
    };
  }, [fetchGroups]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError("");
    if (!newGroupName.trim()) return;

    setCreating(true);
    try {
      await api.post("/groups/create", { name: newGroupName });
      setNewGroupName("");
    } catch (err) {
      setError(err.response?.data?.error || "Could not create group");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (groupId) => {
    setActioningId(groupId);
    try {
      await api.post(`/groups/${groupId}/join`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not join group");
    } finally {
      setActioningId(null);
    }
  };

  const handleLeave = async (groupId) => {
    setActioningId(groupId);
    try {
      await api.delete(`/groups/${groupId}/leave`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not leave group");
    } finally {
      setActioningId(null);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this group? This cannot be undone.",
      )
    ) {
      return;
    }
    setActioningId(groupId);
    try {
      await api.delete(`/groups/${groupId}`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not delete group");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-page-in">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Groups</h2>
        <div className="flex items-center gap-4">
          <Link
            to="/chat"
            className="text-sm text-indigo-600 font-medium hover:underline"
          >
            Direct Messages
          </Link>
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-red-500 transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {error && (
          <p className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
            {error}
          </p>
        )}

        <form onSubmit={handleCreateGroup} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="New group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            disabled={creating}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-20"
          >
            {creating ? <Spinner size="sm" /> : "Create"}
          </button>
        </form>

        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
          All Groups
        </p>

        {groupsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
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
            <p className="font-medium text-gray-500">No groups yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first group above
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    {group.name[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-800 block">
                      {group.name}
                    </span>
                    {group.is_admin && (
                      <span className="text-xs text-indigo-500 font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-center min-w-24 justify-end">
                  {actioningId === group.id ? (
                    <Spinner size="sm" />
                  ) : group.is_member ? (
                    <>
                      <button
                        onClick={() => handleLeave(group.id)}
                        className="text-xs bg-gray-50 text-gray-500 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-100 transition"
                      >
                        Leave
                      </button>
                      {group.is_admin && (
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 transition"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleJoin(group.id)}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 transition"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups;
