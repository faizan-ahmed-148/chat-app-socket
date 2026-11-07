import React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import io from "socket.io-client";

const ChatGroups = ({ isShowUserChat, selectedGroup, setIsShowUserChat, onUnreadCountChange }) => {
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

  const groupId = selectedGroup ? selectedGroup._id : null;
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null);
  const [showNewBar, setShowNewBar] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [roleUpdate, setRoleUpdate] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const socketRef = useRef(null);
  const [leaveError, setLeaveError] = useState("");
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, options: [], query: '', position: 0 });
  const inputRef = useRef(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  const BASE_URL = import.meta.env.VITE_BASE_URL

  // Search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);

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
    if (!groupId) return;

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
      // If user is at bottom, auto scroll to new message
      if (isAtBottom) {
        setTimeout(() => scrollToBottom(), 100);
      }
      
      // Update unread count for new messages and notify parent
      setUnreadCount(prev => prev + 1);
      setShowNewBar(true);
      
      // Notify parent component about new unread message
      if (onUnreadCountChange && selectedGroup) {
        onUnreadCountChange(selectedGroup._id, unreadCount + 1);
      }
    });
    // Initial fetch
    fetchGroup();
    fetchMessages();
    fetchJoinedGroups();
    
    // Don't mark messages as read immediately - let the scroll behavior work first
    
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
    const atBottom = scrollHeight - scrollTop - clientHeight < 40; // 40px threshold
    setIsAtBottom(atBottom);

    // Only mark messages as read if user manually scrolls to bottom AND there are unread messages
    if (atBottom && unreadCount > 0) {
      handleMarkAllSeen();
    }
  };

  // WhatsApp-like behavior: Scroll to first unread message on group entry
  useEffect(() => {
    if (initialLoad && messages.length > 0) {
      const lastSeenIdx = messages.findIndex(m => m._id === lastSeenMessageId);
      
      if (lastSeenIdx >= 0 && lastSeenIdx < messages.length - 1) {
        // Has unread messages - scroll to first unread
        setTimeout(() => {
          const firstUnreadMessage = messages[lastSeenIdx + 1];
          const messageElement = document.querySelector(`[data-message-id="${firstUnreadMessage._id}"]`);
          if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          setInitialLoad(false);
        }, 800);
      } else {
        // No unread messages - scroll to bottom
        setTimeout(() => {
          scrollToBottom();
          setInitialLoad(false);
        }, 300);
      }
    }
  }, [messages, lastSeenMessageId, initialLoad]);

  // Only scroll to bottom if user is at bottom or just sent a message
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

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
        
        // Don't automatically mark messages as read when sending - let user control this
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
      // If no last seen message, all messages are unread
      if (!lastSeenMessageId) {
        setUnreadCount(messages.length);
        setShowNewBar(messages.length > 0);
      } else {
        // If there are new messages after last seen, show bar
        if (messages.some(m => m._id === lastSeenMessageId)) {
          const lastSeenIdx = messages.findIndex(m => m._id === lastSeenMessageId);
          const newMessagesCount = messages.length - lastSeenIdx - 1;
          setUnreadCount(newMessagesCount);
          setShowNewBar(newMessagesCount > 0);
        } else {
          // If last seen message is gone (e.g. deleted), treat all as new
          setUnreadCount(messages.length);
          setShowNewBar(true);
        }
      }
    }
  }, [messages, lastSeenMessageId]);

  // Notify parent component when unread count changes (only when it actually changes)
  useEffect(() => {
    if (onUnreadCountChange && selectedGroup && unreadCount !== undefined) {
      onUnreadCountChange(selectedGroup._id, unreadCount);
    }
  }, [unreadCount, selectedGroup?._id, onUnreadCountChange]);

  // Removed automatic timeout - user will manually mark messages as read

  // Handler to mark all as seen
  const handleMarkAllSeen = () => {
    if (messages.length > 0) {
      const latestId = messages[messages.length - 1]._id;
      setLastSeenMessageId(latestId);
      localStorage.setItem(getLastSeenKey(), latestId);
      setShowNewBar(false);
      setUnreadCount(0);
      
      // Notify parent component that messages are now read
      if (onUnreadCountChange && selectedGroup) {
        onUnreadCountChange(selectedGroup._id, 0);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchGroup = async () => {
    if (!groupId) return;
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
    if (!groupId) return;
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
    if (!addUser.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/add-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pseudonym: addUser })
      });

      const data = await response.json();
      if (response.ok) {
        setAddUser("");
        setSuccess("User added to group!");
        setError("");
        fetchGroup();
        setShowUsers(false); // Close dropdown on success
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError(data.error || "No user exists with this pseudonym");
        setSuccess("");
      }
    } catch (error) {
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

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUsers && !event.target.closest('.add-user-dropdown')) {
        setShowUsers(false);
      }
      if (showSearchInput && !event.target.closest('.search-container')) {
        setShowSearchInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUsers, showSearchInput]);

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

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    if (val.endsWith('@') && group) {
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
    } else if (/@(\w*)$/.test(val) && group) {
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

  if (!selectedGroup) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <div className="text-gray-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Group Selected</h3>
          <p className="text-gray-500 mb-6">Select a group from the sidebar to start chatting or create a new one.</p>
        </div>
      </div>
    );
  }

  if (!group) return (
    <div className="flex items-center justify-center h-full bg-gray-50 w-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-sky-50 w-screen rounded-3xl shadow-lg">
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-200 px-3 rounded-3xl sm:px-6 py-3 sm:py-4 shadow-sm sticky top-0 z-10">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left side - Group info */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800 flex flex-wrap items-center gap-1 sm:gap-2">
                <span className="truncate">{group.name}</span>
                {group.status === "pending" && (
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase font-semibold whitespace-nowrap">
                    Pending
                  </span>
                )}
                {group.status === "rejected" && (
                  <span className="bg-red-100 text-red-800 text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase font-semibold whitespace-nowrap">
                    Rejected
                  </span>
                )}
                {group.status === "approved" && (
                  <span className="bg-green-100 text-green-800 text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase font-semibold whitespace-nowrap">
                    Active
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{group.description}</p>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 lg:gap-3 w-full lg:w-auto flex-wrap">
            {/* Search Button */}
            <div className="search-container">
              <button
                onClick={() => setShowSearchInput(!showSearchInput)}
                className="flex cursor-pointer items-center gap-1 sm:gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>

            {/* Add User Dropdown */}
            {group.creator.toString() === (user?.id || user?._id) && (
              <div className="relative add-user-dropdown">
                <button
                  onClick={() => setShowUsers(!showUsers)}
                  className="flex cursor-pointer items-center gap-1 sm:gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="hidden sm:inline">Add User</span>
                </button>

                {/* Dropdown Menu */}
                {showUsers && (
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-[60]">
                    <div className="p-3 sm:p-4">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2 sm:mb-3">Add User to Group</h3>
                      <form onSubmit={handleAddUser} className="space-y-2 sm:space-y-3">
                        <div>
                          <input
                            type="text"
                            placeholder="Enter user pseudonym..."
                            value={addUser}
                            onChange={(e) => setAddUser(e.target.value)}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs sm:text-sm"
                          />
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            type="submit"
                            className="flex-1 cursor-pointer px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-xs sm:text-sm font-medium transition-colors"
                          >
                            Add User
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowUsers(false)}
                            className="px-2 sm:px-4 cursor-pointer py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs sm:text-sm font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        {success && <p className="text-xs sm:text-sm text-green-600 mt-1 sm:mt-2">{success}</p>}
                        {error && <p className="text-xs sm:text-sm text-red-600 mt-1 sm:mt-2">{error}</p>}
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowMembersModal(true)}
              className="flex cursor-pointer items-center gap-1 sm:gap-2 bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
            >
              <span className="text-xs sm:text-sm">{group.members?.length || 0}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>

            {group.creator.toString() !== (user?.id || user?._id) && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/groups/${group._id}/leave`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    console.log(res, 'res');

                    if (res.ok) {
                      navigate('/dashboard');
                      setIsShowUserChat(false);
                    } else {
                      const data = await res.json();
                      setError(data.error || 'Failed to leave group');
                    }
                  } catch (err) {
                    setError('Failed to leave group');
                  }
                }}
                className="text-red-600 cursor-pointer hover:text-red-800 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap px-1 sm:px-2 py-1 rounded"
              >
                <span className="hidden sm:inline">Leave Group</span>
                <span className="sm:hidden">Leave</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-sky-50 to-sky-50">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Group Members</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{group.members?.length} members</p>
              </div>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-1 cursor-pointer rounded-full hover:bg-gray-100 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500 hover:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 sm:p-4 border-b border-gray-100">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search members..."
                  className="w-full pl-8 sm:pl-10 pr-4 py-1.5 sm:py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-sm"
                />
                <div className="absolute left-2 sm:left-3 top-1.5 sm:top-2.5 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Members List */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
              <ul className="divide-y divide-gray-100">
                {group.members?.map((member) => (
                  <li key={member.user?._id} className="hover:bg-gray-50/50 transition-colors">
                    <div className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
                          <div className={`relative flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white text-sm sm:text-lg font-bold ${getUserColor(member.user?._id)}`}>
                            {member.user?.pseudonym?.[0]?.toUpperCase() || "?"}
                            {member.user?._id === group.creator.toString() && (
                              <span className="absolute -right-0.5 sm:-right-1 bg-sky-500 text-white p-0.5 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 sm:h-3 sm:w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1 sm:space-x-2">
                              <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{member.user?.pseudonym}</p>
                              {member.user?._id === group.creator.toString() && (
                                <span className="bg-sky-100 text-sky-800 text-xs px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">Admin</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{member.user?.role || "Member"}</p>
                          </div>
                        </div>

                        {group.creator.toString() === (user?.id || user?._id) && member.user?._id !== user?.id && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_BASE_URL}/groups/${group._id}/remove-user/${member.user._id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  const updated = await res.json();
                                  setGroup(updated);
                                } else {
                                  const data = await res.json();
                                  setError(data.error || 'Failed to remove user');
                                }
                              } catch (err) {
                                setError('Failed to remove user');
                              }
                            }}
                            className="text-xs sm:text-sm cursor-pointer px-2 sm:px-3 py-1 sm:py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors duration-200 flex items-center space-x-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowMembersModal(false)}
                className="w-full py-2 sm:py-2.5 px-4 bg-sky-600 cursor-pointer hover:bg-sky-700 text-white font-medium rounded-lg transition-colors duration-200 text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto bg-gray-90"
        onScroll={handleScroll}
        ref={messagesContainerRef}
      >
        <div className="max-w-full m-2 sm:m-4 lg:m-5">
          {/* Search Bar - Only show when toggled */}
          <div className="sticky top-1 z-5 rounded-lg p-1 mb-4 search-container">
            {showSearchInput && (
              <div className="relative mb-2 bg-gray-100 rounded-lg shadow-sm p-2">
                <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-xs sm:text-sm"
                  autoFocus
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors mr-1 sm:mr-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setShowSearchInput(false)}
                    className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {group.pinnedMessage && (
              <div 
                className="bg-yellow-50 border-l-4 border-yellow-400 p-2 sm:p-4 rounded-r-lg flex items-start mt-1 cursor-pointer hover:bg-yellow-100 transition-colors"
                onClick={() => {
                  const pinnedMsg = messages.find(m => m._id === group.pinnedMessage);
                  if (pinnedMsg) {
                    const messageElement = document.querySelector(`[data-message-id="${pinnedMsg._id}"]`);
                    if (messageElement) {
                      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      
                    }
                  }
                }}
              >
                <div className="flex-shrink-0 pt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-yellow-800">
                    Pinned Message
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-700 mt-1 line-clamp-2 break-all">
                    {messages.find(m => m._id === group.pinnedMessage)?.content || 'Message not found'}
                  </p>
                </div>
                {group.creator.toString() === (user?.id || user?._id) && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fetch(`${API_BASE_URL}/groups/${group._id}/unpin`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setGroup(g => g ? { ...g, pinnedMessage: null } : g);
                      socketRef.current.emit('unpin', group._id);
                    }}
                    className="ml-1 sm:ml-2 cursor-pointer text-yellow-600 hover:text-yellow-800 transition-colors p-1 rounded hover:bg-yellow-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            </div>

            

          {/* Search Results Indicator */}
          {isSearching && (
            <div className="bg-sky-50 text-sky-800 px-4 py-2 rounded-lg text-sm font-medium mb-4">
              Found {messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length} results
            </div>
          )}

          {/* Pinned Message */}


          {/* New Messages Indicator - Only show when there are unread messages and user is not at bottom */}
          {showNewBar && unreadCount > 0 && !isAtBottom && (
            <div
              onClick={handleMarkAllSeen}
              className="sticky top-16 z-10 bg-green-500 text-white px-4 py-3 rounded-full text-sm font-medium text-center cursor-pointer hover:bg-green-600 transition-colors mb-4 mx-auto w-max shadow-lg"
            >
              {unreadCount} new message{unreadCount !== 1 ? 's' : ''} below ▼
              <div className="text-xs opacity-90 mt-1 font-semibold">
                Click here to mark as read
              </div>
            </div>
          )}

          {/* Messages List */}
          <div className="space-y-2 sm:space-y-3">
            {messages
              .filter(message =>
                !isSearching ||
                message.content.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((message, idx) => {
                const isSender = String(message.sender._id) === String(user?.id || user?._id);
                const isPinned = message._id === group.pinnedMessage;

                return (
                  <div
                    key={message._id}
                    data-message-id={message._id}
                    className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isSender && (
                      <div className={`min-w-6 h-6 rounded-full flex items-center justify-center text-white mx-1 -mt-1 text-xs `} style={{ background: getUserColor(message.sender?._id) }}>
                        {message.sender?.pseudonym?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}

                    <div className={`flex flex-col ${isSender ? 'items-end ml-8 sm:ml-12' : 'items-start mr-8 sm:mr-12'}`}>
                      <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                        <span className="text-xs font-medium text-gray-1000">
                          {message.sender.pseudonym}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className={`relative max-w-full px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg ${isSender ? 'bg-sky-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none shadow'} ${isPinned ? 'ring-2 ring-yellow-400' : ''}`}>
                        <p className="text-xs sm:text-sm break-all">
                          {message.content.split(/(\s+)/).map((word, i) => {
                            // Highlight mentions
                            if (word.startsWith('@')) {
                              const isRole = group.members.some(m => '@' + m.user?.role === word);
                              const isUser = group.members.some(m => '@' + m.user?.pseudonym === word);
                              if (isUser) {
                                return <span key={i} className="bg-sky-100 text-sky-700 font-bold">{word}</span>;
                              } else if (isRole) {
                                return <span key={i} className="bg-purple-100 text-purple-700 font-bold">{word}</span>;
                              }
                            }
                            // Make URLs clickable
                            const urlPattern = /^(https?:\/\/[^\s]+)$/i;
                            if (urlPattern.test(word.trim())) {
                              return (
                                <a
                                  key={i}
                                  href={word.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${isSender ? 'text-sky-200 underline' : 'text-sky-600 underline'}`}
                                >
                                  {word}
                                </a>
                              );
                            }
                            return <span key={i}>{word}</span>;
                          })}
                        </p>

                        {group.creator.toString() === (user?.id || user?._id) && !isPinned && (
                          <button
                            onClick={async () => {
                              await fetch(`${API_BASE_URL}/groups/${group._id}/pin/${message._id}`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              setGroup(g => g ? { ...g, pinnedMessage: message._id } : g);
                              socketRef.current.emit('pin', group._id, message._id);
                            }}
                            className={`absolute -top-1 -right-1 sm:-top-2 sm:-right-2 p-0.5 sm:p-1 cursor-pointer rounded-full ${isSender ? 'bg-sky-700 text-yellow-300 hover:bg-sky-800' : 'bg-white text-yellow-500 hover:bg-gray-100'} shadow-sm transition-colors`}
                            title="Pin message"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-gray-90 border-t border-gray-200 p-2 sm:p-4 sticky bottom-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Mention dropdown */}
            {mentionDropdown.open && mentionDropdown.options.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-10 overflow-hidden">
                {mentionDropdown.options.map((opt, i) => (
                  <button
                    key={`${opt.type}-${opt.id || opt.label}`}
                    type="button"
                    className={`block w-full text-left px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm ${i === mentionDropdown.position ? 'bg-sky-50' : 'hover:bg-gray-50'} ${opt.type === 'role' ? 'text-purple-700 font-medium' : 'text-gray-700'} transition-colors`}
                    onClick={() => selectMention(opt)}
                  >
                    {opt.type === 'role' ? `@${opt.label} (role)` : `@${opt.label}`}
                  </button>
                ))}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              placeholder={
                group.status === 'pending'
                  ? "Group is pending approval - messaging disabled"
                  : group.status === 'rejected'
                    ? "Group was rejected - messaging disabled"
                    : "Type your message..."
              }
              value={newMessage}
              onChange={handleInputChange}
              disabled={group.status === 'pending' || group.status === 'rejected'}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed pr-10 sm:pr-12 text-sm sm:text-base"
            />

            <div className="absolute right-1 sm:right-2 bottom-1 sm:bottom-2 flex space-x-1">
              {/* <button
                type="button"
                className="p-1 text-gray-400 hover:text-sky-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button> */}

              <button
                type="submit"
                disabled={group.status === 'pending' || group.status === 'rejected' || !newMessage.trim()}
                className="p-1 sm:p-1.5 text-sky-600 hover:text-sky-800 disabled:text-gray-400 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatGroups;