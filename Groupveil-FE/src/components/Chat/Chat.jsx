import Dropdown from "../../components/Dropdown";
import { useState, useEffect } from "react";
import PerfectScrollbar from "react-perfect-scrollbar";
import IconHorizontalDots from "../../components/Icon/IconHorizontalDots";
import IconHelpCircle from "../../components/Icon/IconHelpCircle";
import IconLogin from "../../components/Icon/IconLogin";
import IconSearch from "../../components/Icon/IconSearch";
import IconMessagesDot from "../../components/Icon/IconMessagesDot";
import IconUserPlus from "../../components/Icon/IconUserPlus";
import IconMenu from "../../components/Icon/IconMenu";
import IconMessage from "../../components/Icon/IconMessage";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ChatGroups from "./ChatGroups";
import IconRefresh from "../Icon/IconRefresh";
import toast from "react-hot-toast";
import { getToken } from "firebase/messaging";
import { register_firebase_token } from "../../helper";
import { messaging } from "../../helper/firebaseinit";
import notificationService from "../../services/notificationService";

const Chat = () => {
  const isRtl = false;
  const [isShowChatMenu, setIsShowChatMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("myGroups"); // 'myGroups', 'pendingGroups', 'memberGroups'
  const [isShowUserChat, setIsShowUserChat] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [memberGroups, setMemberGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [notification, setNotification] = useState(null);
  const isDark = false;
  const { user, token, dispatch } = useAuth();
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_API_BASE_URL

  const [filteredMyGroups, setFilteredMyGroups] = useState([]);
  const [ispendingGroups, setPendingGroups] = useState([]);
  const [filteredMemberGroups, setFilteredMemberGroups] = useState([]);

  const getLastSeenKey = (groupId) => `lastSeenMessageId_${groupId}`;

  const getUnreadCount = (group) => {
    console.log('getUnreadCount called for:', group.name, {
      groupUnreadCount: group.unreadCount,
      messagesLength: group.messages?.length,
      groupId: group._id
    });
    
    // Use backend-provided unread count if available
    if (group.unreadCount !== undefined) {
      console.log('Using backend unread count:', group.unreadCount);
      return group.unreadCount;
    }
    
    // Fallback to client-side calculation
    if (!group.messages || group.messages.length === 0) {
      console.log('No messages, returning 0');
      return 0;
    }
    
    const lastSeenId = localStorage.getItem(getLastSeenKey(group._id));
    console.log('Last seen ID:', lastSeenId);
    
    if (!lastSeenId) {
      // If no last seen message, all messages are unread
      console.log('No last seen ID, all messages unread:', group.messages.length);
      return group.messages.length;
    }
    
    const idx = group.messages.findIndex((m) => m._id === lastSeenId);
    console.log('Last seen message index:', idx);
    
    if (idx === -1) {
      // If last seen message is not found, all messages are unread
      console.log('Last seen message not found, all messages unread:', group.messages.length);
      return group.messages.length;
    }
    
    // Return count of messages after the last seen message
    const unreadCount = Math.max(0, group.messages.length - (idx + 1));
    console.log('Calculated unread count:', unreadCount);
    return unreadCount;
  };

  const groupColors = [
    "#1976d2",
    "#7b1fa2",
    "#388e3c",
    "#fbc02d",
    "#e64a19",
    "#0288d1",
    "#c2185b",
    "#0097a7",
    "#afb42b",
    "#5d4037",
  ];

  function getGroupColor(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++)
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return groupColors[Math.abs(hash) % groupColors.length];
  }

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredMyGroups(myGroups);
      setFilteredMemberGroups(memberGroups);
    } else {
      const query = searchQuery.toLowerCase();
      const filteredMy = myGroups.filter(
        (group) =>
          group.name.toLowerCase().includes(query) ||
          group.description.toLowerCase().includes(query)
      );
      const filteredMember = memberGroups.filter(
        (group) =>
          group.name.toLowerCase().includes(query) ||
          group.description.toLowerCase().includes(query)
      );

      setFilteredMyGroups(filteredMy);
      setFilteredMemberGroups(filteredMember);
    }
  }, [myGroups, memberGroups, searchQuery]);


  const fcm = async () => {
    // Request notification permission using the notification service
    const permissionGranted = await notificationService.requestPermission();

    if (permissionGranted) {
      console.log("Notification permission granted.");

      // Ensure messaging is initialized
      if (messaging) {
        let currentToken
        try {
          // Get the token (this will work after service worker is registered)
          currentToken = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_API_VPID_KEY,
          });

          if (currentToken) {
            console.log("FCM Token:", currentToken);
            if (token && currentToken) {
              register_firebase_token(currentToken, token, BASE_URL);
            }
            // Send the token to your server or use it as needed
          } else {
            console.log("No registration token available.");
          }
        } catch (error) {
          console.warn("Error getting FCM token:", error);
        }
      }
    } else {
      console.log("Notification permission denied or not supported.");
    }
  };
  useEffect(() => {
    if(token){
      fcm();
    }
  }, [token]);

  const fetchCounts = async (groups, setter) => {
    // Get last seen message IDs from localStorage
    const lastSeenMessageIds = {};
    groups.forEach(group => {
      const lastSeenId = localStorage.getItem(getLastSeenKey(group._id));
      if (lastSeenId) {
        lastSeenMessageIds[group._id] = lastSeenId;
      }
    });

    try {
      // Fetch unread counts from backend
      const unreadCountsRes = await fetch(
        `${BASE_URL}/groups/unread-counts?lastSeenMessageIds=${encodeURIComponent(JSON.stringify(lastSeenMessageIds))}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const unreadCounts = await unreadCountsRes.json();
      console.log('Backend unread counts response:', unreadCounts);

      // Fetch messages for each group and add unread count
      const updated = await Promise.all(
        groups.map(async (group) => {
          try {
            const res = await fetch(
              `${BASE_URL}/messages/group/${group._id}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const msgs = await res.json();
            
            // Use backend unread count, but fallback to client-side calculation if backend returns 0
            let finalUnreadCount = unreadCounts[group._id] || 0;
            
            // If backend says 0 unread but we have messages, do client-side calculation
            if (finalUnreadCount === 0 && Array.isArray(msgs) && msgs.length > 0) {
              const lastSeenId = localStorage.getItem(getLastSeenKey(group._id));
              if (lastSeenId) {
                const idx = msgs.findIndex((m) => m._id === lastSeenId);
                if (idx >= 0) {
                  finalUnreadCount = Math.max(0, msgs.length - (idx + 1));
                } else {
                  finalUnreadCount = msgs.length; // All messages unread if last seen not found
                }
              } else {
                finalUnreadCount = msgs.length; // All messages unread if no last seen
              }
              console.log(`Fallback client-side calculation for ${group.name}: ${finalUnreadCount}`);
            }
            
            return { 
              ...group, 
              messages: Array.isArray(msgs) ? msgs : [],
              unreadCount: finalUnreadCount
            };
          } catch {
            return { 
              ...group, 
              messages: [],
              unreadCount: unreadCounts[group._id] || 0
            };
          }
        })
      );
      setter(updated);
    } catch (error) {
      console.error('Failed to fetch unread counts:', error);
      // Fallback to old method
      const updated = await Promise.all(
        groups.map(async (group) => {
          try {
            const res = await fetch(
              `${BASE_URL}/messages/group/${group._id}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const msgs = await res.json();
            return { ...group, messages: Array.isArray(msgs) ? msgs : [] };
          } catch {
            return { ...group, messages: [] };
          }
        })
      );
      setter(updated);
    }
  };

  const refreshGroups = () => {
    setLastRefresh(Date.now());
  };

  // Function to refresh unread counts when user returns to chat list
  const refreshUnreadCounts = async () => {
    try {
      const lastSeenMessageIds = {};
      [...myGroups, ...memberGroups].forEach(group => {
        const lastSeenId = localStorage.getItem(getLastSeenKey(group._id));
        if (lastSeenId) {
          lastSeenMessageIds[group._id] = lastSeenId;
        }
      });

      const unreadCountsRes = await fetch(
        `${BASE_URL}/groups/unread-counts?lastSeenMessageIds=${encodeURIComponent(JSON.stringify(lastSeenMessageIds))}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const unreadCounts = await unreadCountsRes.json();

      // Update groups with new unread counts
      setMyGroups(prev => prev.map(group => ({
        ...group,
        unreadCount: unreadCounts[group._id] || 0
      })));
      setMemberGroups(prev => prev.map(group => ({
        ...group,
        unreadCount: unreadCounts[group._id] || 0
      })));
    } catch (error) {
      console.error('Failed to refresh unread counts:', error);
    }
  };

  // Handle unread count changes from ChatGroups
  const handleUnreadCountChange = (groupId, newCount) => {
    setMyGroups(prev => prev.map(group => 
      group._id === groupId ? { ...group, unreadCount: newCount } : group
    ));
    setMemberGroups(prev => prev.map(group => 
      group._id === groupId ? { ...group, unreadCount: newCount } : group
    ));
  };

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        const [myResponse, memberResponse] = await Promise.all([
          fetch(`${BASE_URL}/groups/mine`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE_URL}/groups/member`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (myResponse.ok && memberResponse.ok) {
          const myData = await myResponse.json();
          const memberData = await memberResponse.json();
          const pendingGroups = myData.filter(
            (group) => group.status === "pending"
          );
          setPendingGroups(pendingGroups);
          
          // Combine created groups and member groups for "My Groups" tab
          const combinedMyGroups = [...myData, ...memberData];
          await fetchCounts(combinedMyGroups, setMyGroups);
          await fetchCounts(memberData, setMemberGroups);
        } else {
          setError("Failed to fetch groups");
        }
      } catch (error) {
        setError("Failed to fetch groups");
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [lastRefresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshGroups();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Refresh unread counts when user returns to chat list
  useEffect(() => {
    if (!isShowUserChat && myGroups.length > 0) {
      refreshUnreadCounts();
    }
  }, [isShowUserChat]);

  // Refresh unread counts periodically to ensure real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isShowUserChat && myGroups.length > 0) {
        refreshUnreadCounts();
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [isShowUserChat, myGroups.length]);

  useEffect(() => {
    const checkStatusChanges = () => {
      myGroups.forEach((group) => {
        const lastStatus = localStorage.getItem(`groupStatus_${group._id}`);
        if (lastStatus && lastStatus !== group.status) {
          let message = "";
          if (group.status === "approved") {
            message = `🎉 Your group "${group.name}" has been approved!`;
          } else if (group.status === "rejected") {
            message = `❌ Your group "${group.name}" was rejected.`;
          }
          setNotification({
            message,
            type: group.status === "approved" ? "success" : "error",
          });
          setTimeout(() => setNotification(null), 5000);
        }
        localStorage.setItem(`groupStatus_${group._id}`, group.status);
      });
    };

    if (myGroups.length > 0) {
      checkStatusChanges();
    }
  }, [myGroups]);

  const handleLogout = () => {
    dispatch({ type: "LOGOUT" });
    navigate("/");
  };

  const scrollToBottom = () => {
    if (isShowUserChat) {
      setTimeout(() => {
        const element = document.querySelector(".chat-conversation-box");
        if (element) {
          element.behavior = "smooth";
          element.scrollTop = element.scrollHeight;
        }
      });
    }
  };

  const selectGroup = (group) => {
    if (group?.status == "approved") {
      setSelectedGroup(group);
      setIsShowUserChat(true);
      setIsShowChatMenu(false);
      
      // Don't automatically scroll to bottom - let ChatGroups handle the scroll behavior
      // based on whether there are unread messages
    } else {
      setIsShowUserChat(false);
      setIsShowChatMenu(true);
    }
  };

  const statusColors = {
    pending: "bg-yellow-500",
    rejected: "bg-red-500",
    approved: "bg-green-800",
  };
  const GroupItem = ({ group, selectedGroup, selectGroup }) => {
    const isCreator = group?.creator?._id === user?.id;
    const unreadCount = getUnreadCount(group);
    
    // Debug logging
    console.log('GroupItem Debug:', {
      groupName: group.name,
      unreadCount,
      groupUnreadCount: group.unreadCount,
      messagesLength: group.messages?.length,
      lastSeenId: localStorage.getItem(getLastSeenKey(group._id)),
      isSelected: selectedGroup?._id === group._id
    });
    
    return (
      <div key={group?._id}>
        <button
          type="button"
          className={`cursor-pointer flex w-full items-center justify-between rounded-md p-2 hover:bg-gray-100 hover:text-primary ${selectedGroup && selectedGroup?._id === group?._id
            ? "bg-gray-300 text-primary"
            : ""
            }`}
          onClick={() => selectGroup(group)}
        >
          <div className="flex-1">
            <div className="flex items-center">
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold"
                  style={{ backgroundColor: getGroupColor(group._id) }}
                >
                  {group.name.charAt(0).toUpperCase()}
                </div>
                {group.status === "approved" && (
                  <div className="absolute bottom-0 right-0">
                    <div className="h-4 w-4 rounded-full bg-success"></div>
                  </div>
                )}
                {group.status === "pending" && (
                  <div className="absolute bottom-0 right-0">
                    <div className="h-4 w-4 rounded-full bg-red"></div>
                  </div>
                )}
                {/* WhatsApp-like unread message count badge */}
                {unreadCount > 0 && group.status === "approved" && selectedGroup?._id !== group._id && (
                  <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center font-bold px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </div>
              <div className="mx-3 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold">{group.name}</p>
                 
                </div>
                <p className="max-w-[185px] truncate text-xs text-white-dark">
                  {group?.description}
                </p>
                {group.status === "pending" && (
                  <p className="mt-2 text-xs italic text-yellow-600">
                    Waiting for admin approval
                  </p>
                )}
                {group.status === "rejected" && (
                  <p className="mt-2 text-xs italic text-red-600">
                    Group was rejected by admin
                  </p>
                )}
                {/* {group.status === "approved" && (
                  <p className="mt-2 text-xs italic text-green-700">
                    ✓ Group is active and ready to use
                  </p>
                )} */}
              </div>
            </div>
          </div>
          <div
           
          >
            <p className="mb-2">
            {isCreator && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                      Created
                    </span>
                  )}
                  {!isCreator && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">
                      Member
                    </span>
                  )}
            </p>
            <p  className={`whitespace-nowrap rounded-full p-1 px-3 text-xs font-semibold text-white
                      ${statusColors[group?.status] || "bg-green-500"}
                    `}>
              {group?.status === "pending"
                ? "Pending"
                : group?.status === "rejected"
                  ? "Rejected"
                  : "Active"}
            </p>
          </div>
        </button>
      </div>
    );
  };
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-black-500 font-nunito text-sm font-normal antialiased p-5" >
      {notification && (
        <div
          className="fixed right-5 top-5 z-50 rounded-lg px-5 py-3 text-white shadow-lg"
          style={{
            background: notification.type === "success" ? "#4caf50" : "#f44336",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Mobile menu button */}
      <button
        onClick={() => setIsShowChatMenu(!isShowChatMenu)}
        className="fixed left-4 top-4 cursor-pointer z-30 xl:hidden m-1"
      >
        <IconMenu className="h-6 w-6 text-gray-600 hover:text-primary" />
      </button>

      {/* Sidebar */}
      <div
        className={`mx-1 bg-gray-100 absolute z-20 h-full w-full max-w-sm rounded-3xl  flex-none space-y-4 overflow-hidden  p-4 transition-transform duration-300 xl:relative xl:block xl:translate-x-0 ${isShowChatMenu ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-center gap-1">
          <div className="flex-none">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold"
            >
              <img className="rounded-full object-cover" src="/groupveil.png" alt="groupveil" />
            </div>
          </div>
          <div className="mx-3">
            <h1 className="mb-1 font-semibold " style={{ fontSize: "1.1rem" }} >Groupveil</h1>
          </div>
        </div>
        <div className="w-full border-b border-white-light"></div>

        <div className="flex justify-between items-center">

          <div className="flex items-center">
            <div className="flex-none">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold bg-sky-600"

              >
                {user?.pseudonym.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="mx-3">
              <p className="mb-1 font-semibold">{user?.pseudonym}</p>
              <p className="text-xs text-white-dark flex items-center gap-1">
                {user?.uniqueId}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user?.uniqueId || '');
                    toast.success('Copied to clipboard');
                    // Optional: Show a toast notification
                  }}
                  className="hover:text-primary cursor-pointer focus:outline-none"
                  title="Copy to clipboard"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </p>
            </div>
          </div>
          <div className="dropdown">
            <Dropdown
              offset={[0, 5]}
              placement={`${isRtl ? "bottom-start" : "bottom-end"}`}
              btnClassName="flex h-8 w-8 items-center justify-center cursor-pointer rounded-full bg-grey hover:bg-primary-light hover:text-primary"
              button={<IconHorizontalDots className="opacity-70" />}
            >
              <ul className="w-40 whitespace-nowrap rounded-lg border border-gray-100 bg-white px-2 py-2 shadow-lg">
                <li>
                  <button
                    onClick={refreshGroups}
                    disabled={loading}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <IconRefresh className="h-5 w-5 opacity-80" />
                    <span className="flex-1 text-left">
                      Refresh {loading ? "🔄" : "🔄"}
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleLogout}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <IconLogin className="h-5 w-5 opacity-80" />
                    <span className="flex-1 text-left">Sign Out</span>
                  </button>
                </li>
              </ul>
            </Dropdown>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            className="w-full rounded-full border border-grey py-2 pl-4 pr-10 focus:border-primary focus:shadow-md"
            placeholder="Searching..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 peer-focus:text-primary">
            <IconSearch />
          </div>
        </div>
        <div className="flex flex-row items-start justify-between gap-5 text-sm">
          <button
            type="button"
            className="hover:text-primary cursor-pointer flex gap-1 items-center"
            onClick={() => navigate("/groups/create")}
          >
            <IconUserPlus className="mx-auto mb-1" />
            Create Groups
          </button>

          <button
            type="button"
            className="hover:text-primary cursor-pointer flex gap-1 items-center"
            onClick={refreshGroups}
            disabled={loading}
          >
            <IconRefresh className="mx-auto mb-1" />
            Refresh
          </button>
        </div>

        <div className="w-full border-b border-white-light"></div>
        <div className="relative">
          {/* Scrollable Tab Container */}
          <div className="flex gap-2 pb-1 border-b border-gray-200 overflow-x-auto scrollbar-hide whitespace-nowrap">
            {/* My Groups Tab */}
            <button
              className={`cursor-pointer relative py-3 px-2 font-medium text-sm transition-all duration-200 ${activeTab === "myGroups"
                ? "text-sky-600 hover:bg-sky-90 bg-sky-100 border-b-2 border-sky-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
              onClick={() => setActiveTab("myGroups")}
            >
              <div className="flex items-center gap-2 ">
                {/* <span className="bg-green-800 rounded-full text-white px-2 py-0.3 text-xs font-semibold">
                  {filteredMyGroups?.length}
                </span> */}
                My Groups
              </div>
              {activeTab === "myGroups" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>

            {/* Pending Groups Tab */}
            <button
              className={`cursor-pointer relative py-3 px-2 font-medium text-sm transition-all duration-200 ${activeTab === "pendingGroups"
                ? "text-sky-600 hover:bg-sky-90 bg-sky-100 border-b-2 border-sky-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
              onClick={() => setActiveTab("pendingGroups")}
            >
              <div className="flex items-center gap-2">
                {/* <span className="bg-yellow-500 rounded-full text-white px-2 py-0.3 text-xs font-semibold">
                  {ispendingGroups?.length}
                </span> */}
                Pending Groups
              </div>
              {activeTab === "pendingGroups" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>

            {/* Member Groups Tab */}
            <button
              className={`cursor-pointer relative py-3 px-2 font-medium text-sm transition-all duration-200 ${activeTab === "memberGroups"
                ? "text-sky-600 hover:bg-sky-90 bg-sky-100 border-b-2 border-sky-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
              onClick={() => setActiveTab("memberGroups")}
            >
              <div className="flex items-center gap-2">
                {/* <span className="bg-green-800 rounded-full text-white px-2 text-xs py-0.3 font-semibold">
                  {filteredMemberGroups?.length}
                </span> */}
                Member Groups
              </div>
              {activeTab === "memberGroups" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          </div>

          {/* Optional: Add these styles to your CSS for better scroll behavior */}
          <style jsx>{`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `}</style>
        </div>
        {/* Tab Content */}
        <div className="relative h-[calc(100vh-307px)] max-h-[100vh] w-full">
          <PerfectScrollbar className="overflow-x-hidden h-full">
            <div className="space-y-0.5 py-3 pr-2">
              {/* My Groups Tab */}
              {activeTab === "myGroups" && (
                <>
                  {filteredMyGroups.length === 0 ? (
                    <p className="text-white-dark">
                      {searchQuery
                        ? "No groups found matching your search."
                        : "You have not created or joined any groups yet."}
                    </p>
                  ) : (
                    filteredMyGroups.map((group) => (
                      <GroupItem
                        key={group._id}
                        group={group}
                        selectedGroup={selectedGroup}
                        selectGroup={selectGroup}
                      />
                    ))
                  )}
                </>
              )}

              {/* Pending Groups Tab */}
              {activeTab === "pendingGroups" && (
                <>
                  {ispendingGroups?.length === 0 ? (
                    <p className="text-white-dark">
                      {searchQuery
                        ? "No pending groups found matching your search."
                        : "You have no pending group requests."}
                    </p>
                  ) : (
                    ispendingGroups.map((group) => (
                      <GroupItem
                        key={group._id}
                        group={group}
                        selectedGroup={selectedGroup}
                        selectGroup={selectGroup}
                      />
                    ))
                  )}
                </>
              )}

              {/* Member Groups Tab */}
              {activeTab === "memberGroups" && (
                <>
                  {filteredMemberGroups.length === 0 ? (
                    <p className="text-white-dark">
                      {searchQuery
                        ? "No groups found matching your search."
                        : "You are not a member of any groups yet."}
                    </p>
                  ) : (
                    filteredMemberGroups.map((group) => (
                      <GroupItem
                        key={group._id}
                        group={group}
                        selectedGroup={selectedGroup}
                        selectGroup={selectGroup}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          </PerfectScrollbar>
        </div>

        <div className="w-full border-b border-white-light"></div>

      </div>

      {/* Overlay for mobile */}
      {isShowChatMenu && (
        <div
          className="fixed inset-0 z-[5] hidden h-full w-full rounded-md bg-black/60 xl:!hidden"
          onClick={() => setIsShowChatMenu(false)}
        ></div>
      )}

      {/* Main content area */}
      <div className="panel relative flex h-full w-full overflow-hidden p-0">
        {!isShowUserChat && (
          <div className="flex h-full w-full items-center justify-center p-4">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-8 h-[calc(100vh-320px)] max-h-[430px] min-h-[120px] w-[280px] text-white md:w-[430px]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  data-name="Layer 1"
                  className="w-full h-full"
                  viewBox="0 0 891.29496 745.19434"
                  xmlns-xlink="http://www.w3.org/1999/xlink"
                >
                  <ellipse
                    cx="418.64354"
                    cy="727.19434"
                    rx="352"
                    ry="18"
                    fill={isDark ? "#888ea8" : "#e6e6e6"}
                  />
                  <path
                    d="M778.64963,250.35008h-3.99878V140.80476a63.40187,63.40187,0,0,0-63.4018-63.40193H479.16232a63.40188,63.40188,0,0,0-63.402,63.4017v600.9744a63.40189,63.40189,0,0,0,63.4018,63.40192H711.24875a63.40187,63.40187,0,0,0,63.402-63.40168V328.32632h3.99878Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#3f3d56"
                  />
                  <path
                    d="M761.156,141.24713v600.09a47.35072,47.35072,0,0,1-47.35,47.35h-233.2a47.35084,47.35084,0,0,1-47.35-47.35v-600.09a47.3509,47.3509,0,0,1,47.35-47.35h28.29a22.50659,22.50659,0,0,0,20.83,30.99h132.96a22.50672,22.50672,0,0,0,20.83-30.99h30.29A47.35088,47.35088,0,0,1,761.156,141.24713Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="currentColor"
                  />
                  <path
                    d="M686.03027,400.0032q-2.32543,1.215-4.73047,2.3-2.18994.99-4.4497,1.86c-.5503.21-1.10987.42-1.66992.63a89.52811,89.52811,0,0,1-13.6001,3.75q-3.43506.675-6.96,1.06-2.90991.33-5.87989.47c-1.41015.07-2.82031.1-4.24023.1a89.84124,89.84124,0,0,1-16.75977-1.57c-1.44043-.26-2.85009-.57-4.26025-.91a88.77786,88.77786,0,0,1-19.66992-7.26c-.56006-.28-1.12012-.58-1.68018-.87-.83008-.44-1.63965-.9-2.4497-1.38.38964-.54.81005-1.07,1.23974-1.59a53.03414,53.03414,0,0,1,78.87012-4.1,54.27663,54.27663,0,0,1,5.06006,5.86C685.25977,398.89316,685.6499,399.44321,686.03027,400.0032Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#6c63ff"
                  />
                  <circle
                    cx="492.14325"
                    cy="234.76352"
                    r="43.90974"
                    fill="#2f2e41"
                  />
                  <circle
                    cx="642.49883"
                    cy="327.46205"
                    r="32.68086"
                    transform="translate(-232.6876 270.90663) rotate(-28.66315)"
                    fill="#a0616a"
                  />
                  <path
                    d="M676.8388,306.90589a44.44844,44.44844,0,0,1-25.402,7.85033,27.23846,27.23846,0,0,0,10.796,4.44154,89.62764,89.62764,0,0,1-36.61.20571,23.69448,23.69448,0,0,1-7.66395-2.63224,9.699,9.699,0,0,1-4.73055-6.3266c-.80322-4.58859,2.77227-8.75743,6.488-11.567a47.85811,47.85811,0,0,1,40.21662-8.03639c4.49246,1.16124,8.99288,3.12327,11.91085,6.731s3.78232,9.16981,1.00224,12.88488Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#2f2e41"
                  />
                  <path
                    d="M644.5,230.17319a89.98675,89.98675,0,0,0-46.83984,166.83l.58007.34q.72.43506,1.43995.84c.81005.48,1.61962.94,2.4497,1.38.56006.29,1.12012.59,1.68018.87a88.77786,88.77786,0,0,0,19.66992,7.26c1.41016.34,2.81982.65,4.26025.91a89.84124,89.84124,0,0,0,16.75977,1.57c1.41992,0,2.83008-.03,4.24023-.1q2.97-.135,5.87989-.47,3.52513-.39,6.96-1.06a89.52811,89.52811,0,0,0,13.6001-3.75c.56005-.21,1.11962-.42,1.66992-.63q2.26464-.87,4.4497-1.86,2.40015-1.08,4.73047-2.3a90.7919,90.7919,0,0,0,37.03955-35.97c.04-.07995.09034-.16.13038-.24a89.30592,89.30592,0,0,0,9.6499-26.41,90.051,90.051,0,0,0-88.3501-107.21Zm77.06006,132.45c-.08008.14-.1499.28-.23.41a88.17195,88.17195,0,0,1-36.48,35.32q-2.29542,1.2-4.66992,2.25c-1.31006.59-2.64991,1.15-4,1.67-.57032.22-1.14991.44-1.73.64a85.72126,85.72126,0,0,1-11.73,3.36,84.69473,84.69473,0,0,1-8.95019,1.41c-1.8501.2-3.73.34-5.62012.41-1.21.05-2.42969.08-3.6499.08a86.762,86.762,0,0,1-16.21973-1.51,85.62478,85.62478,0,0,1-9.63037-2.36,88.46592,88.46592,0,0,1-13.98974-5.67c-.52-.27-1.04-.54-1.5503-.82-.73-.39-1.46972-.79-2.18994-1.22-.54-.3-1.08008-.62-1.60986-.94-.31006-.18-.62012-.37-.93018-.56a88.06851,88.06851,0,1,1,123.18018-32.47Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#3f3d56"
                  />
                  <path
                    d="M624.2595,268.86254c-.47244-4.968-6.55849-8.02647-11.3179-6.52583s-7.88411,6.2929-8.82863,11.19308a16.0571,16.0571,0,0,0,2.16528,12.12236c2.40572,3.46228,6.82664,5.623,10.95,4.74406,4.70707-1.00334,7.96817-5.59956,8.90127-10.32105s.00667-9.58929-.91854-14.31234Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#2f2e41"
                  />
                  <path
                    d="M691.24187,275.95964c-.47245-4.968-6.5585-8.02646-11.3179-6.52582s-7.88412,6.29289-8.82864,11.19307a16.05711,16.05711,0,0,0,2.16529,12.12236c2.40571,3.46228,6.82663,5.623,10.95,4.74406,4.70707-1.00334,7.96817-5.59955,8.90127-10.32105s.00667-9.58929-.91853-14.31234Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#2f2e41"
                  />
                  <path
                    d="M488.93638,356.14169a4.47525,4.47525,0,0,1-3.30664-1.46436L436.00767,300.544a6.02039,6.02039,0,0,0-4.42627-1.94727H169.3618a15.02615,15.02615,0,0,1-15.00928-15.00927V189.025a15.02615,15.02615,0,0,1,15.00928-15.00928H509.087A15.02615,15.02615,0,0,1,524.0963,189.025v94.5625A15.02615,15.02615,0,0,1,509.087,298.59676h-9.63135a6.01157,6.01157,0,0,0-6.00464,6.00489v47.0332a4.474,4.474,0,0,1-2.87011,4.1958A4.52563,4.52563,0,0,1,488.93638,356.14169Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="currentColor"
                  />
                  <path
                    d="M488.93638,356.14169a4.47525,4.47525,0,0,1-3.30664-1.46436L436.00767,300.544a6.02039,6.02039,0,0,0-4.42627-1.94727H169.3618a15.02615,15.02615,0,0,1-15.00928-15.00927V189.025a15.02615,15.02615,0,0,1,15.00928-15.00928H509.087A15.02615,15.02615,0,0,1,524.0963,189.025v94.5625A15.02615,15.02615,0,0,1,509.087,298.59676h-9.63135a6.01157,6.01157,0,0,0-6.00464,6.00489v47.0332a4.474,4.474,0,0,1-2.87011,4.1958A4.52563,4.52563,0,0,1,488.93638,356.14169ZM169.3618,176.01571A13.024,13.024,0,0,0,156.35252,189.025v94.5625a13.024,13.024,0,0,0,13.00928,13.00927H431.5814a8.02436,8.02436,0,0,1,5.90039,2.59571l49.62208,54.1333a2.50253,2.50253,0,0,0,4.34716-1.69092v-47.0332a8.0137,8.0137,0,0,1,8.00464-8.00489H509.087a13.024,13.024,0,0,0,13.00928-13.00927V189.025A13.024,13.024,0,0,0,509.087,176.01571Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#3f3d56"
                  />
                  <circle
                    cx="36.81601"
                    cy="125.19345"
                    r="13.13371"
                    fill="#6c63ff"
                  />
                  <path
                    d="M493.76439,275.26947H184.68447a7.00465,7.00465,0,1,1,0-14.00929H493.76439a7.00465,7.00465,0,0,1,0,14.00929Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill={isDark ? "#888ea8" : "#e6e6e6"}
                  />
                  <path
                    d="M393.07263,245.49973H184.68447a7.00465,7.00465,0,1,1,0-14.00929H393.07263a7.00464,7.00464,0,0,1,0,14.00929Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill={isDark ? "#888ea8" : "#e6e6e6"}
                  />
                  <path
                    d="M709.41908,676.83065a4.474,4.474,0,0,1-2.87011-4.1958v-47.0332a6.01157,6.01157,0,0,0-6.00464-6.00489H690.913a15.02615,15.02615,0,0,1-15.00928-15.00927V510.025A15.02615,15.02615,0,0,1,690.913,495.01571H1030.6382a15.02615,15.02615,0,0,1,15.00928,15.00928v94.5625a15.02615,15.02615,0,0,1-15.00928,15.00927H768.4186a6.02039,6.02039,0,0,0-4.42627,1.94727l-49.62207,54.1333a4.47525,4.47525,0,0,1-3.30664,1.46436A4.52563,4.52563,0,0,1,709.41908,676.83065Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="currentColor"
                  />
                  <path
                    d="M709.41908,676.83065a4.474,4.474,0,0,1-2.87011-4.1958v-47.0332a6.01157,6.01157,0,0,0-6.00464-6.00489H690.913a15.02615,15.02615,0,0,1-15.00928-15.00927V510.025A15.02615,15.02615,0,0,1,690.913,495.01571H1030.6382a15.02615,15.02615,0,0,1,15.00928,15.00928v94.5625a15.02615,15.02615,0,0,1-15.00928,15.00927H768.4186a6.02039,6.02039,0,0,0-4.42627,1.94727l-49.62207,54.1333a4.47525,4.47525,0,0,1-3.30664,1.46436A4.52563,4.52563,0,0,1,709.41908,676.83065ZM690.913,497.01571A13.024,13.024,0,0,0,677.9037,510.025v94.5625A13.024,13.024,0,0,0,690.913,617.59676h9.63135a8.0137,8.0137,0,0,1,8.00464,8.00489v47.0332a2.50253,2.50253,0,0,0,4.34716,1.69092l49.62208-54.1333a8.02436,8.02436,0,0,1,5.90039-2.59571h262.2196a13.024,13.024,0,0,0,13.00928-13.00927V510.025a13.024,13.024,0,0,0-13.00928-13.00928Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#3f3d56"
                  />
                  <path
                    d="M603.53027,706.11319a89.06853,89.06853,0,0,1-93.65039,1.49,54.12885,54.12885,0,0,1,9.40039-12.65,53.43288,53.43288,0,0,1,83.90967,10.56994C603.2998,705.71316,603.41992,705.91318,603.53027,706.11319Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#6c63ff"
                  />
                  <circle
                    cx="398.44256"
                    cy="536.68841"
                    r="44.20157"
                    fill="#2f2e41"
                  />
                  <circle
                    cx="556.81859"
                    cy="629.4886"
                    r="32.89806"
                    transform="translate(-416.96496 738.72884) rotate(-61.33685)"
                    fill="#ffb8b8"
                  />
                  <path
                    d="M522.25039,608.79582a44.74387,44.74387,0,0,0,25.57085,7.9025,27.41946,27.41946,0,0,1-10.8677,4.47107,90.22316,90.22316,0,0,0,36.85334.20707,23.852,23.852,0,0,0,7.71488-2.64973,9.76352,9.76352,0,0,0,4.762-6.36865c.80855-4.61909-2.7907-8.81563-6.53113-11.64387a48.17616,48.17616,0,0,0-40.4839-8.08981c-4.52231,1.169-9.05265,3.144-11.99,6.77579s-3.80746,9.23076-1.0089,12.97052Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#2f2e41"
                  />
                  <path
                    d="M555.5,721.17319a89.97205,89.97205,0,1,1,48.5708-14.21875A89.87958,89.87958,0,0,1,555.5,721.17319Zm0-178a88.00832,88.00832,0,1,0,88,88A88.09957,88.09957,0,0,0,555.5,543.17319Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill="#3f3d56"
                  />
                  <circle
                    cx="563.81601"
                    cy="445.19345"
                    r="13.13371"
                    fill="#6c63ff"
                  />
                  <path
                    d="M1020.76439,595.26947H711.68447a7.00465,7.00465,0,1,1,0-14.00929h309.07992a7.00464,7.00464,0,0,1,0,14.00929Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill={isDark ? "#888ea8" : "#e6e6e6"}
                  />
                  <path
                    d="M920.07263,565.49973H711.68447a7.00465,7.00465,0,1,1,0-14.00929H920.07263a7.00465,7.00465,0,0,1,0,14.00929Z"
                    transform="translate(-154.35252 -77.40283)"
                    fill={isDark ? "#888ea8" : "#e6e6e6"}
                  />
                  <ellipse
                    cx="554.64354"
                    cy="605.66091"
                    rx="24.50394"
                    ry="2.71961"
                    fill={isDark ? "#888ea8" : "#e6e6e6"}
                  />
                  <ellipse
                    cx="335.64354"
                    cy="285.66091"
                    rx="24.50394"
                    ry="2.71961"
                    fill={isDark ? "#888ea8" : "#e6e6e6"}
                  />
                </svg>
              </div>
              <p className="mx-auto flex max-w-full items-center justify-center rounded-md bg-white-dark/20 p-2 font-semibold">
                <IconMessage className="mr-2" />
                Say hello to controlled communication.
              </p>
            </div>
          </div>
        )}
        {isShowUserChat && selectedGroup && (
          <ChatGroups
            isShowUserChat={isShowUserChat}
            selectedGroup={selectedGroup}
            setIsShowUserChat={setIsShowUserChat}
            isShowChatMenu={isShowChatMenu}
            loginUser={user}
            onUnreadCountChange={handleUnreadCountChange}
          />
        )}
      </div>
    </div>
  );
};

// Reusable Group Item Component

export default Chat;
