import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import io from 'socket.io-client';
import groupveilLogo from '../assets/groupveil.png';

const GroupChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [group, setGroup] = useState(null);
  const [addUser, setAddUser] = useState("");
  const [error, setError] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [success, setSuccess] = useState("");
  const { token, user } = useAuth();
  
  const { groupId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null);
  const [showNewBar, setShowNewBar] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  // Track if user is at the bottom
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [roleUpdate, setRoleUpdate] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const socketRef = useRef(null);
  const [leaveError, setLeaveError] = useState("");
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, options: [], query: '', position: 0 });
  const inputRef = useRef(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  const BASE_URL = import.meta.env.VITE_BASE_URL

  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Groups search functionality
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [filteredJoinedGroups, setFilteredJoinedGroups] = useState([]);

  // Helper to get/set last seen from localStorage per group
  const getLastSeenKey = () => `lastSeenMessageId_${groupId}`;

  // Helper to get a color for a user (deterministic by user._id)
  const userColors = [
    '#1976d2', '#7b1fa2', '#388e3c', '#fbc02d', '#e64a19', '#0288d1', '#c2185b', '#0097a7', '#afb42b', '#5d4037'
  ];
  function getUserColor(id) {
    if (!id) return '#888';
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return userColors[Math.abs(hash) % userColors.length];
  }

  // Filter messages based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredMessages(messages);
      setIsSearching(false);
    } else {
      const filtered = messages.filter(message =>
        message.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMessages(filtered);
      setIsSearching(true);
    }
  }, [messages, searchQuery]);

  // Filter groups based on search query
  useEffect(() => {
    if (groupSearchQuery.trim() === "") {
      setFilteredJoinedGroups(joinedGroups);
    } else {
      const query = groupSearchQuery.toLowerCase();
      const filtered = joinedGroups.filter(group =>
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query)
      );
      setFilteredJoinedGroups(filtered);
    }
  }, [joinedGroups, groupSearchQuery]);

  useEffect(() => {
    // Connect to socket.io
    if (!socketRef.current) {
      socketRef.current = io(`${BASE_URL}`);
    }
    const socket = socketRef.current;
    // Join group room
    socket.emit('join', groupId);
    // Listen for new messages
    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    // Initial fetch
    fetchGroup();
    fetchMessages();
    fetchJoinedGroups();
    // Cleanup
    return () => {
      socket.emit('leave', groupId);
      socket.off('message');
    };
  }, [groupId]);

  // Listen for pin/unpin events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.on('pin', (msgId) => {
      setGroup((g) => g ? { ...g, pinnedMessage: msgId } : g);
    });
    socket.on('unpin', () => {
      setGroup((g) => g ? { ...g, pinnedMessage: null } : g);
    });
    return () => {
      socket.off('pin');
      socket.off('unpin');
    };
  }, []);

  // Scroll handler
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 40); // 40px threshold
  };

  // Only scroll to bottom if user is at bottom or just sent a message
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
    // eslint-disable-next-line
  }, [messages]);

  // When user sends a message, always scroll to bottom
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newMessage, groupId })
      });
      if (response.ok) {
        setNewMessage("");
        fetchMessages();
        setTimeout(() => scrollToBottom(), 100); // force scroll after send
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (error) {
      setError("Failed to send message");
    }
  };

  useEffect(() => {
    // On mount or group change, load last seen from localStorage
    const stored = localStorage.getItem(getLastSeenKey());
    setLastSeenMessageId(stored);
  }, [groupId]);

  useEffect(() => {
    if (messages.length > 0) {
      const latestId = messages[messages.length - 1]._id;
      // If no last seen, set it to latest (first visit)
      if (!lastSeenMessageId) {
        setLastSeenMessageId(latestId);
        localStorage.setItem(getLastSeenKey(), latestId);
        setShowNewBar(false);
      } else {
        // If there are new messages after last seen, show bar
        if (messages.some(m => m._id === lastSeenMessageId)) {
          const lastSeenIdx = messages.findIndex(m => m._id === lastSeenMessageId);
          setShowNewBar(lastSeenIdx < messages.length - 1);
        } else {
          // If last seen message is gone (e.g. deleted), treat all as new
          setShowNewBar(true);
        }
      }
    }
  }, [messages, lastSeenMessageId]);

  // Handler to mark all as seen
  const handleMarkAllSeen = () => {
    if (messages.length > 0) {
      const latestId = messages[messages.length - 1]._id;
      setLastSeenMessageId(latestId);
      localStorage.setItem(getLastSeenKey(), latestId);
      setShowNewBar(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchGroup = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        // Check if group is pending/rejected and user is not the creator
        if ((data.status === 'pending' || data.status === 'rejected') && data.creator !== user._id) {
          setError(`This group is ${data.status} and not accessible.`);
          setTimeout(() => navigate("/dashboard"), 2000);
          return;
        }
        setGroup(data);
      } else if (response.status === 403) {
        setError("Access denied. This group may be pending approval or rejected.");
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setError("Failed to fetch group");
      }
    } catch (error) {
      setError("Failed to fetch group");
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/messages/group/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages");
    }
  };

  const fetchJoinedGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setJoinedGroups(data);
      }
    } catch (error) {
      setError("Failed to fetch joined groups");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    console.log('🔍 handleAddUser called!');
    console.log('🔍 addUser value:', addUser);
    console.log('🔍 groupId:', groupId);
    
    if (!addUser.trim()) {
      console.log('🔍 addUser is empty, returning');
      return;
    }

    try {
      console.log('🔍 Making API call to add user...');
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/add-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pseudonym: addUser })
      });

      console.log('🔍 Response status:', response.status);
      const data = await response.json();
      console.log('🔍 Response data:', data);

      if (response.ok) {
        setAddUser("");
        setSuccess("User added to group!");
        setError("");
        fetchGroup();
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError(data.error || "No user exists with this pseudonym");
        setSuccess("");
      }
    } catch (error) {
      console.error('🔍 Error adding user:', error);
      setError("Failed to add user");
      setSuccess("");
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/users/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setAvailableUsers(data);
        setShowUsers(!showUsers);
      }
    } catch (error) {
      setError("Failed to fetch users");
    }
  };

  // Mention logic
  useEffect(() => {
    if (!mentionDropdown.open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        setMentionDropdown(d => ({ ...d, position: Math.min(d.position + 1, d.options.length - 1) }));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setMentionDropdown(d => ({ ...d, position: Math.max(d.position - 1, 0) }));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const option = mentionDropdown.options[mentionDropdown.position];
        if (option) selectMention(option);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setMentionDropdown(d => ({ ...d, open: false }));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mentionDropdown]);

  const selectMention = (option) => {
    const atIdx = newMessage.lastIndexOf('@');
    if (atIdx !== -1) {
      setNewMessage(newMessage.slice(0, atIdx + 1) + option.insert + ' ');
      setMentionDropdown({ open: false, options: [], query: '', position: 0 });
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
  }, [user?.id]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    if (val.endsWith('@')) {
      // Show all options
      const memberOptions = group.members.map(m => ({
        label: `${m.user?.pseudonym} (${m.user?.role})`,
        insert: m.user?.pseudonym,
        type: 'user',
        id: m.user?._id
      }));
      const roleOptions = [
        ...new Set(group.members.map(m => m.user?.role))
      ].map(role => ({ label: role, insert: role, type: 'role' }));
      setMentionDropdown({ open: true, options: [...memberOptions, ...roleOptions], query: '', position: 0 });
    } else if (/@(\w*)$/.test(val)) {
      // Filter options
      const query = val.match(/@(\w*)$/)[1].toLowerCase();
      const memberOptions = group.members.filter(m => m.user?.pseudonym.toLowerCase().includes(query)).map(m => ({
        label: `${m.user?.pseudonym} (${m.user?.role})`,
        insert: m.user?.pseudonym,
        type: 'user',
        id: m.user?._id
      }));
      const roleOptions = [
        ...new Set(group.members.map(m => m.user?.role))
      ].filter(role => role && role.toLowerCase().includes(query)).map(role => ({ label: role, insert: role, type: 'role' }));
      setMentionDropdown({ open: true, options: [...memberOptions, ...roleOptions], query, position: 0 });
    } else {
      setMentionDropdown(d => d.open ? { ...d, open: false } : d);
    }
    if (showNewBar) handleMarkAllSeen();
  };

  if (!group) return <div>Loading...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)", padding: 0, display: "flex", flexDirection: "column", alignItems: 'center' }}>
        {/* Logo section */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', borderBottom: "1px solid var(--border)", padding: '32px 0 18px 0', borderTopLeftRadius: 'var(--radius)' }}>
          <img src={groupveilLogo} alt="GroupVeil Logo" style={{ width: 64, height: 64, marginBottom: 10, borderRadius: '16px', boxShadow: '0 2px 12px #e3e8ee' }} />
          <div style={{ fontWeight: 900, fontSize: 28, color: '#19213a', letterSpacing: 0.5, fontFamily: 'Inter, Segoe UI, Arial, sans-serif', marginBottom: 6 }}>groupveil</div>
        </div>
        {/* Groups heading and user info */}
        <div style={{ width: '100%', padding: '0 24px', marginTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--primary)', paddingLeft: 8 }}>Welcome, {user?.pseudonym}</div>
          <div style={{ color: "var(--text-light)", fontSize: 14, marginBottom: 8, paddingLeft: 8 }}>{user?.role}</div>
          <h3 style={{ margin: '32px 0 16px 0', fontSize: 20, color: '#19213a', fontWeight: 800, letterSpacing: 0.5, paddingLeft: 8 }}>Groups</h3>
          
          {/* Groups Search Bar */}
          <div style={{
            background: '#fff',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <input
              type="text"
              placeholder="Search groups..."
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: '1px solid #e3e8ee',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 13,
                outline: 'none'
              }}
            />
            {groupSearchQuery && (
              <button
                onClick={() => setGroupSearchQuery("")}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '2px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", width: '100%', padding: '0 16px 24px 16px' }}>
          {filteredJoinedGroups.length === 0 ? (
            <p style={{ color: "#888", paddingLeft: 8 }}>
              {groupSearchQuery ? "No groups found matching your search." : "You have not joined any groups yet."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredJoinedGroups.map((g) => (
                <div
                  key={g._id}
                  style={{
                    border: g._id === groupId ? "2px solid var(--primary)" : "1px solid var(--primary)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    backgroundColor: g._id === groupId ? "#eaf0fa" : "#fff",
                    fontWeight: g._id === groupId ? 700 : 500,
                    margin: '0 8px',
                    paddingLeft: 8 // Add left padding
                  }}
                  onClick={() => navigate(`/groups/${g._id}`)}
                >
                  <div>{g.name}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>{g.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff" }}>
        <div className="card" style={{ padding: "20px 24px 16px 24px", borderBottom: "1px solid var(--border)", borderRadius: 'var(--radius) var(--radius) 0 0', boxShadow: 'var(--shadow)', background: '#fff', margin: 0 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "7px 18px",
              backgroundColor: "#fff",
              color: "var(--primary)",
              border: "1.5px solid var(--primary)",
              borderRadius: "var(--radius)",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: 'none',
              marginBottom: 8
            }}
          >
             Back to Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ color: 'var(--primary)', margin: 0 }}>{group.name}</h2>
            {group.status === 'pending' && (
              <span style={{
                background: '#f57c00',
                color: '#fff',
                borderRadius: '12px',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                Pending Approval
              </span>
            )}
            {group.status === 'rejected' && (
              <span style={{
                background: '#d32f2f',
                color: '#fff',
                borderRadius: '12px',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                Rejected
              </span>
            )}
            {group.status === 'approved' && (
              <span style={{
                background: '#2e7d32',
                color: '#fff',
                borderRadius: '12px',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                Active
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-light)', marginTop: 0 }}>{group.description}</p>
          {group.status === 'pending' && (
            <div style={{ 
              fontSize: 13, 
              color: '#f57c00', 
              marginTop: 8,
              padding: '8px 12px',
              background: '#fff3e0',
              borderRadius: '6px',
              border: '1px solid #ffb74d'
            }}>
              ⚠️ This group is pending admin approval. You can view it but cannot send messages or add members until approved.
            </div>
          )}
          {group.status === 'rejected' && (
            <div style={{ 
              fontSize: 13, 
              color: '#d32f2f', 
              marginTop: 8,
              padding: '8px 12px',
              background: '#ffebee',
              borderRadius: '6px',
              border: '1px solid #ef5350'
            }}>
              ❌ This group was rejected by admin. You can view it but cannot send messages or add members.
            </div>
          )}
          <div style={{ margin: '10px 0 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowMembersModal(true)}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 16px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: '0 1px 4px #e3e8ee',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span style={{ fontWeight: 700 }}>{group.members?.length || 0}</span> Users
            </button>
          </div>
          {showMembersModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.25)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
              onClick={() => { setShowMembersModal(false); setShowMemberMenu(false); }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  minWidth: 320,
                  maxWidth: 400,
                  boxShadow: '0 8px 32px rgba(25,118,210,0.13)',
                  padding: 24,
                  position: 'relative',
                  maxHeight: '70vh',
                  overflowY: 'auto'
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => { setShowMembersModal(false); setShowMemberMenu(false); }}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 14,
                    background: 'none',
                    border: 'none',
                    fontSize: 22,
                    color: '#888',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
                <h3 style={{ color: 'var(--primary)', margin: '0 0 12px 0', fontSize: 20 }}>Group Members</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {group.members?.map((m, idx) => (
                    <li key={m.user?._id || idx} style={{
                      padding: '10px 0',
                      borderBottom: idx !== group.members.length - 1 ? '1px solid #e3e8ee' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      position: 'relative',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{m.user?.pseudonym}</span>
                      <span style={{ color: '#888', fontSize: 13, fontWeight: 500 }}>({m.user?.role})</span>
                      {/* Action menu for group creator */}
                      {group.creator === user?.id && m.user?._id !== user?.id && (
                        <span style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={{
                              background: '#e64a19',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: 'pointer'
                            }}
                            onClick={async () => {
                              setMemberActionError("");
                              try {
                                const res = await fetch(`${API_BASE_URL}/groups/${group._id}/remove-user/${m.user._id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  const updated = await res.json();
                                  setGroup(updated);
                                } else {
                                  const data = await res.json();
                                  setMemberActionError(data.error || 'Failed to remove user');
                                }
                              } catch (err) {
                                setMemberActionError('Failed to remove user');
                              }
                            }}
                          >Remove</button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {memberActionError && <div style={{ color: 'red', marginTop: 8 }}>{memberActionError}</div>}
              </div>
            </div>
          )}
          <div style={{ marginTop: "10px" }}>
            {console.log('🔍 Rendering add user section. group.creator:', group.creator, 'user?.id:', user?.id, 'isCreator:', group.creator.toString() === user?.id)}
            {group.creator.toString() === (user?.id || user?._id) && (
              <div>
                <div style={{ color: 'blue', fontSize: '12px', marginBottom: '5px' }}>Debug: You are the group creator, showing add user form</div>
                <form onSubmit={handleAddUser} style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                  <input
                    type="text"
                    placeholder="Add user by pseudonym (e.g., Developer-123)"
                    value={addUser}
                    onChange={(e) => setAddUser(e.target.value)}
                    style={{ flex: 1, padding: "12px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", fontSize: 16, color: '#222', background: '#fff' }}
                  />
                  <button
                    type="submit"
                    onClick={() => console.log('🔍 Add User button clicked!')}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "var(--primary)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "var(--radius)",
                      fontWeight: 600,
                      fontSize: 16,
                      boxShadow: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Add User
                  </button>
                </form>
              </div>
            )}
            {group.creator.toString() !== (user?.id || user?._id) && (
              <div style={{ color: 'orange', fontSize: '12px', marginBottom: '5px' }}>Debug: You are NOT the group creator, cannot add users</div>
            )}
            {success && <div style={{ color: 'green', marginTop: 4 }}>{success}</div>}
            {error && <div style={{ color: 'red', marginTop: 4 }}>{error}</div>}
          </div>
        </div>
        {/* Leave group button for non-creator */}
        {group.creator.toString() !== (user?.id || user?._id) && (
          <div style={{ padding: '12px 24px 0 24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              style={{
                background: '#e64a19',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 1px 4px #e3e8ee'
              }}
              onClick={async () => {
                setLeaveError("");
                try {
                  const res = await fetch(`${API_BASE_URL}/groups/${group._id}/leave`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) {
                    navigate('/dashboard');
                  } else {
                    const data = await res.json();
                    setLeaveError(data.error || 'Failed to leave group');
                  }
                } catch (err) {
                  setLeaveError('Failed to leave group');
                }
              }}
            >Leave Group</button>
            {leaveError && <span style={{ color: 'red', marginLeft: 16 }}>{leaveError}</span>}
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 0 0 0", background: 'var(--background)' }}
          onScroll={handleScroll}
        >
          <div style={{ padding: "24px 24px 0 24px" }}>
            {/* Global Search Bar - Sticky at top */}
            <div style={{
              background: '#fff',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              margin: '0 0 16px 0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <span style={{ color: '#666', fontSize: 16 }}>🔍</span>
              <input
                type="text"
                placeholder="Search messages in this chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  background: 'transparent'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Search Results Count */}
            {isSearching && (
              <div style={{
                background: '#e3f2fd',
                color: '#1976d2',
                padding: '8px 16px',
                borderRadius: 8,
                margin: '0 0 16px 0',
                fontSize: 14,
                fontWeight: 500
              }}>
                Found {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''} for "{searchQuery}"
              </div>
            )}
            
            {/* Pinned message */}
            {group.pinnedMessage && (
              <div style={{
                background: '#fffde7',
                border: '1.5px solid #ffe082',
                borderRadius: 10,
                padding: '12px 18px',
                margin: '0 0 16px 0',
                boxShadow: '0 2px 8px #ffe08244',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                position: 'sticky',
                top: 0,
                zIndex: 5
              }}>
                <span style={{ fontWeight: 700, color: '#fbc02d' }}>📌 Pinned:</span>
                <span style={{ color: '#222' }}>{messages.find(m => m._id === group.pinnedMessage)?.content || 'Message not found'}</span>
                {group.creator === user?.id && (
                  <button
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e64a19', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
                    onClick={async () => {
                      await fetch(`${API_BASE_URL}/groups/${group._id}/unpin`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setGroup(g => g ? { ...g, pinnedMessage: null } : g);
                      socketRef.current.emit('unpin', group._id);
                    }}
                  >Unpin</button>
                )}
              </div>
            )}
            
            {filteredMessages.map((message, idx) => {
              // Insert new message bar if needed
              let showBar = false;
              if (showNewBar && lastSeenMessageId && message._id !== lastSeenMessageId) {
                const lastSeenIdx = messages.findIndex(m => m._id === lastSeenMessageId);
                // Only show the bar if the first new message is NOT sent by the current user
                if (
                  idx === lastSeenIdx + 1 &&
                  String(message.sender._id) !== String(user?.id || user?._id)
                ) {
                  showBar = true;
                }
              }
              const isSender = String(message.sender._id) === String(user?.id || user?._id);
              return (
                <React.Fragment key={message._id}>
                  {showBar && (
                    <div
                      onClick={handleMarkAllSeen}
                      style={{
                        background: '#e3f2fd',
                        color: '#1976d2',
                        textAlign: 'center',
                        padding: '6px 0',
                        margin: '12px 0',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 4px #e3e8ee'
                      }}
                    >
                      New messages below
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: isSender ? 'flex-end' : 'flex-start', gap: 8 }}>
                    {/* Avatar (left for others, right for sender) */}
                    {!isSender && (
                      <span style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: getUserColor(message.sender._id),
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                        marginRight: 2,
                        textTransform: 'uppercase',
                        letterSpacing: 1
                      }}>{message.sender.pseudonym?.[0] || '?'}</span>
                    )}
                    {/* Pin button (outside bubble) - only if not pinned and only on correct side */}
                    {!isSender && group.creator === user?.id && (!group.pinnedMessage || group.pinnedMessage !== message._id) && (
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#fbc02d',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 18,
                          marginTop: 2
                        }}
                        title="Pin message"
                        onClick={async () => {
                          await fetch(`${API_BASE_URL}/groups/${group._id}/pin/${message._id}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          setGroup(g => g ? { ...g, pinnedMessage: message._id } : g);
                          socketRef.current.emit('pin', group._id, message._id);
                        }}
                      >📌</button>
                    )}
                    <div
                      style={{
                        marginBottom: "18px",
                        padding: "14px 18px",
                        backgroundColor: isSender ? "var(--primary)" : "#f5f5f5",
                        color: isSender ? "#fff" : "#222",
                        borderRadius: isSender ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        maxWidth: "70%",
                        marginLeft: isSender ? "auto" : "0",
                        marginRight: isSender ? 10 : 0,
                        boxShadow: 'var(--shadow)',
                        fontSize: 16
                      }}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: "5px", color: isSender ? '#bbdefb' : 'var(--primary)' }}>
                        {message.sender.pseudonym} ({message.sender.role})
                        {/* Show filled pin only for the pinned message */}
                        {group.creator === user?.id && group.pinnedMessage === message._id && (
                          <span style={{ marginLeft: 10, color: '#fbc02d', fontWeight: 700, fontSize: 16 }}>📌</span>
                        )}
                      </div>
                      {/* Highlight mentions in message content */}
                      <div>
                        {message.content.split(/(\s+)/).map((word, i) => {
                          // Highlight mentions
                          if (word.startsWith('@')) {
                            const isRole = group.members.some(m => '@' + m.user?.role === word);
                            const isUser = group.members.some(m => '@' + m.user?.pseudonym === word);
                            if (isUser) {
                              return <span key={i} style={{ background: '#e3f2fd', color: '#1976d2', fontWeight: 700 }}>{word}</span>;
                            } else if (isRole) {
                              return <span key={i} style={{ background: '#f3e5f5', color: '#7b1fa2', fontWeight: 700 }}>{word}</span>;
                            }
                          }
                          // Make URLs clickable
                          const urlPattern = /^(https?:\/\/[^\s]+)$/i;
                          if (urlPattern.test(word.trim())) {
                            return <a key={i} href={word.trim()} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', wordBreak: 'break-all' }}>{word}</a>;
                          }
                          return <span key={i}>{word}</span>;
                        })}
                      </div>
                      <div style={{ fontSize: "12px", color: isSender ? "#bbdefb" : "#888", marginTop: "5px" }}>
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {isSender && (
                      <span style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: getUserColor(message.sender._id),
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                        marginLeft: 2,
                        textTransform: 'uppercase',
                        letterSpacing: 1
                      }}>{message.sender.pseudonym?.[0] || '?'}</span>
                    )}
                    {/* Pin button for sender (right) - only if not pinned and only for sender */}
                    {isSender && group.creator === user?.id && (!group.pinnedMessage || group.pinnedMessage !== message._id) && (
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#fbc02d',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 18,
                          marginTop: 2
                        }}
                        title="Pin message"
                        onClick={async () => {
                          await fetch(`${API_BASE_URL}/groups/${group._id}/pin/${message._id}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          setGroup(g => g ? { ...g, pinnedMessage: message._id } : g);
                          socketRef.current.emit('pin', group._id, message._id);
                        }}
                      >📌</button>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <form onSubmit={handleSendMessage} style={{ display: "flex", padding: "16px 24px", borderTop: "1px solid var(--border)", background: "#fff", borderRadius: '0 0 var(--radius) var(--radius)' }}>
          <div style={{ position: 'relative', flex: 1, width: '100%' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder={group.status === 'pending' ? "Group is pending approval - messaging disabled" : 
                         group.status === 'rejected' ? "Group was rejected - messaging disabled" : 
                         "Type your message..."}
              value={newMessage}
              onChange={handleInputChange}
              disabled={group.status === 'pending' || group.status === 'rejected'}
              style={{ 
                width: 'calc(100% - 3px)', 
                padding: "14px", 
                borderRadius: "var(--radius)", 
                border: "1.5px solid var(--border)", 
                marginRight: "10px", 
                fontSize: 16, 
                color: (group.status === 'pending' || group.status === 'rejected') ? '#999' : '#222', 
                background: (group.status === 'pending' || group.status === 'rejected') ? '#f5f5f5' : '#fff',
                cursor: (group.status === 'pending' || group.status === 'rejected') ? 'not-allowed' : 'text'
              }}
            />
            {/* Mention dropdown (open above input) */}
            {mentionDropdown.open && mentionDropdown.options.length > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                bottom: '100%',
                background: '#fff',
                border: '1.5px solid #e3e8ee',
                borderRadius: 8,
                boxShadow: '0 2px 12px #e3e8ee',
                zIndex: 10,
                minWidth: 180,
                marginBottom: 2,
                maxHeight: 180,
                overflowY: 'auto',
                width: '100%'
              }}>
                {mentionDropdown.options.map((opt, i) => (
                  <div
                    key={opt.type + '-' + (opt.id || opt.label)}
                    style={{
                      padding: '8px 14px',
                      background: i === mentionDropdown.position ? '#e3f2fd' : 'transparent',
                      color: opt.type === 'role' ? '#7b1fa2' : '#1976d2',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 15
                    }}
                    onMouseDown={e => { e.preventDefault(); selectMention(opt); }}
                  >
                    {opt.type === 'role' ? 'Role: ' : ''}{opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={group.status === 'pending' || group.status === 'rejected'}
            style={{
              padding: "14px 32px",
              backgroundColor: (group.status === 'pending' || group.status === 'rejected') ? "#ccc" : "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius)",
              fontWeight: 600,
              fontSize: 16,
              boxShadow: 'none',
              cursor: (group.status === 'pending' || group.status === 'rejected') ? 'not-allowed' : 'pointer'
            }}
          >
            {(group.status === 'pending' || group.status === 'rejected') ? 'Disabled' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GroupChat;
