import React, { useState, useEffect } from 'react';
import {
  LockClosedIcon,
  ArrowUpIcon,
  UsersIcon,
  ChatBubbleBottomCenterTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowLeftOnRectangleIcon,
  PencilIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterIcon,
  ArrowLeftEndOnRectangleIcon
} from '@heroicons/react/24/outline';

const StatsCard = ({ label, value, icon, color }) => {
  const colors = {
    blue: 'bg-sky-100 text-sky-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    indigo: 'bg-indigo-100 text-indigo-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-start">
      <div className={`rounded-lg p-3 ${colors[color]}`}>
        {icon}
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

const AdminPanel = ({ adminCredentials, onLogout }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  
  const [pendingGroups, setPendingGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [statusDialog, setStatusDialog] = useState({ open: false, group: null });
  const [newStatus, setNewStatus] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);
  const BASE_URL = import.meta.env.VITE_API_BASE_URL

  // Helper function to make authenticated API calls
  const makeAuthenticatedRequest = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      username: adminCredentials.username,
      password: adminCredentials.password,
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers
    });
  };

  // Refresh all data
  const refreshAllData = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      // Refresh stats
      const statsResponse = await makeAuthenticatedRequest(`${BASE_URL}/admin/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
        setStatsError(null);
      } else {
        setStatsError('Failed to load stats');
      }

      // Refresh current tab data
      const endpoints = [
        `${BASE_URL}/admin/pending-groups`,
        `${BASE_URL}/admin/pending-groups`,
        `${BASE_URL}/admin/all-groups`,
        `${BASE_URL}/admin/users`
      ];
      
      const currentResponse = await makeAuthenticatedRequest(endpoints[activeTab]);
      
      if (currentResponse.ok) {
        const currentData = await currentResponse.json();
        if (activeTab === 1) setPendingGroups(currentData);
        else if (activeTab === 2) setAllGroups(currentData);
        else if (activeTab === 3) setUsers(currentData);
        
        // Show success notification for manual refresh
        if (!refreshing) {
          setNotification({
            message: 'Data refreshed successfully',
            type: 'success'
          });
          setTimeout(() => setNotification(null), 2000);
        }
      } else {
        setError('Failed to refresh data');
      }
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const response = await makeAuthenticatedRequest(`${BASE_URL}/admin/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          setStatsError(null);
        } else {
          setStatsError('Failed to load stats');
        }
      } catch (err) {
        setStatsError('Failed to load stats');
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [adminCredentials]);

  // Fetch data based on active tab
  useEffect(() => {
    const fetchTabData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const endpoints = [
          `${BASE_URL}/admin/pending-groups`,
          `${BASE_URL}/admin/pending-groups`,
          `${BASE_URL}/admin/all-groups`,
          `${BASE_URL}/admin/users`
         
        ];
        
        const response = await makeAuthenticatedRequest(endpoints[activeTab]);
        if (response.ok) {
          const data = await response.json();
          if (activeTab === 1) setPendingGroups(data);
          else if (activeTab === 2) setAllGroups(data);
          else if (activeTab === 3) setUsers(data);
        } else {
          setError('Failed to load data');
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchTabData();
  }, [activeTab, adminCredentials]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAllData();
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const handleStatusChange = async () => {
    try {
      const group = statusDialog.group;
      let endpoint = '';
      let body = { adminNotes };

      if (newStatus === 'approved') {
        endpoint = `${BASE_URL}/admin/groups/${group._id}/approve`;
        body = { paymentAmount: parseFloat(paymentAmount), adminNotes };
      } else if (newStatus === 'rejected') {
        endpoint = `${BASE_URL}/admin/groups/${group._id}/reject`;
      }else if (newStatus === 'pending') {
        endpoint = `${BASE_URL}/admin/groups/${group._id}/pending`;
      }

      const response = await makeAuthenticatedRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      
      if (response.ok) {
        setStatusDialog({ open: false, group: null });
        setNewStatus('');
        setPaymentAmount('');
        setAdminNotes('');
        
        // Refresh all data immediately after status change
        console.log('🔍 Refreshing all data immediately after status change...');
        
        await refreshAllData();
        
        // Show success notification
        setNotification({
          message: `Group "${group.name}" status updated to ${newStatus}`,
          type: 'success'
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setError('Failed to update group status');
        setNotification({
          message: 'Failed to update group status',
          type: 'error'
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      setError('Failed to update group status');
      setNotification({
        message: 'Failed to update group status',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const openStatusDialog = (group) => {
    setStatusDialog({ open: true, group });
    setNewStatus(group.status);
    setPaymentAmount(group.paymentAmount?.toString() || '');
    setAdminNotes(group.adminNotes || '');
  };

  const handleLogout = () => {
    localStorage.removeItem('adminCredentials');
    onLogout();
  };

  const statsConfig = [
    { 
      label: 'Total Users', 
      value: stats?.totalUsers ?? '-', 
      icon: <UsersIcon className="h-6 w-6" />,
      color: 'indigo'
    },
    { 
      label: 'Total Groups', 
      value: stats?.totalGroups ?? '-', 
      icon: <UserGroupIcon className="h-6 w-6" />,
      color: 'purple'
    },
    { 
      label: 'Total Messages', 
      value: stats?.totalMessages ?? '-', 
      icon: <ChatBubbleBottomCenterIcon className="h-6 w-6" />,
      color: 'blue'
    },
    { 
      label: 'Pending Groups', 
      value: stats?.pendingGroups ?? '-', 
      icon: <ClockIcon className="h-6 w-6" />,
      color: 'yellow'
    },
    { 
      label: 'Approved Groups', 
      value: stats?.approvedGroups ?? '-', 
      icon: <CheckCircleIcon className="h-6 w-6" />,
      color: 'green'
    },
    { 
      label: 'Paid Users', 
      value: stats?.paidUsers ?? '-', 
      icon: <ArrowUpIcon className="h-6 w-6" />,
      color: 'red'
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } animate-fade-in`}>
          {notification.message}
        </div>
      )}
      
      {/* App Bar */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {adminCredentials.username}</span>
            <button
              onClick={refreshAllData}
              disabled={refreshing}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            >
              <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftEndOnRectangleIcon className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="mb-8">
          {statsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500"></div>
            </div>
          ) : statsError ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{statsError}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {statsConfig.map((stat) => (
                <StatsCard 
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  color={stat.color}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab(0)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${activeTab === 0 ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab(1)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${activeTab === 1 ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Pending Groups
              </button>
              <button
                onClick={() => setActiveTab(2)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${activeTab === 2 ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                All Groups
              </button>
              <button
                onClick={() => setActiveTab(3)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${activeTab === 3 ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Users
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Dashboard Tab */}
              {activeTab === 0 && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Quick Overview</h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-base font-medium text-gray-900 mb-4">
                        Recent Pending Groups ({pendingGroups.slice(0, 3).length})
                      </h3>
                      {pendingGroups.slice(0, 3).map((group) => (
                        <div key={group._id} className="mb-4 p-4 bg-yellow-50 rounded-lg">
                          <h4 className="text-sm font-semibold text-gray-900">{group.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{group.description}</p>
                          <p className="text-xs text-gray-400 mt-2">By: {group.creator?.pseudonym}</p>
                        </div>
                      ))}
                      {pendingGroups.length === 0 && (
                        <p className="text-sm text-gray-500">No pending groups</p>
                      )}
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-base font-medium text-gray-900 mb-4">
                        Recent Users ({users.slice(0, 3).length})
                      </h3>
                      {users.slice(0, 3).map((user) => (
                        <div key={user._id} className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="text-sm font-semibold text-gray-900">{user.pseudonym}</h4>
                          <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${getPaymentStatusColor(user.paymentStatus)}`}>
                            {user.paymentStatus}
                          </span>
                        </div>
                      ))}
                      {users.length === 0 && (
                        <p className="text-sm text-gray-500">No users found</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Groups Tab */}
              {activeTab === 1 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-900">
                      Pending Groups ({pendingGroups.length})
                    </h2>
                  </div>
                  {pendingGroups.length === 0 ? (
                    <p className="text-sm text-gray-500">No pending groups</p>
                  ) : (
                    <div className="space-y-4">
                      {pendingGroups.map((group) => (
                        <div key={group._id} className="bg-white rounded-lg shadow p-6 border border-gray-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">{group.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                              <p className="text-xs text-gray-400 mt-2">
                                Created by: {group.creator?.pseudonym} ({group.creator?.email})
                              </p>
                              <p className="text-xs text-gray-400">
                                Created: {new Date(group.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => openStatusDialog(group)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                            >
                              <PencilIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
                              Change Status
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All Groups Tab */}
              {activeTab === 2 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-900">
                      All Groups ({allGroups.length})
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {allGroups.map((group) => (
                      <div key={group._id} className="bg-white rounded-lg shadow p-6 border border-gray-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">{group.name}</h3>
                            <p className="text-sm text-gray-500">{group.description}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              Creator: {group.creator?.pseudonym}
                            </p>
                            {group.paymentAmount && (
                              <p className="text-xs text-gray-400">
                                Payment: ${group.paymentAmount}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(group.status)}`}>
                              {group.status}
                            </span>
                            <button
                              onClick={() => openStatusDialog(group)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                            >
                              <PencilIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 3 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-900">
                      All Users ({users.length})
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user._id} className="bg-white rounded-lg shadow p-6 border border-gray-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">{user.pseudonym}</h3>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              Groups Created: {user.totalGroupsCreated} | 
                              Groups Approved: {user.totalGroupsApproved}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(user.paymentStatus)}`}>
                              {user.paymentStatus}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {user.subscriptionPlan}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status Change Dialog */}
        {statusDialog.open && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
      <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Change Group Status
                  </h3>
                  {statusDialog.group && (
                    <div className="mb-6">
                      <h4 className="text-base font-semibold text-gray-900">{statusDialog.group.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">{statusDialog.group.description}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Created by: {statusDialog.group.creator?.pseudonym} ({statusDialog.group.creator?.email})
                      </p>
                      
                      <div className="mt-4">
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                          Status
                        </label>
                        <select
                          id="status"
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      
                      {newStatus === 'approved' && (
                        <div className="mt-4">
                          <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700">
                            Payment Amount
                          </label>
                          <input
                            type="number"
                            id="paymentAmount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-sky-500 focus:border-sky-500 border-gray-300 rounded-md"
                            placeholder="Enter payment amount"
                          />
                        </div>
                      )}
                      
                      <div className="mt-4">
                        <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700">
                          Admin Notes
                        </label>
                        <textarea
                          id="adminNotes"
                          rows={3}
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-sky-500 focus:border-sky-500 border-gray-300 rounded-md"
                          placeholder="Optional notes about this status change"
                        ></textarea>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    onClick={() => setStatusDialog({ open: false, group: null })}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:col-start-1 sm:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStatusChange}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-sky-600 text-base font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:col-start-2 sm:text-sm"
                  >
                    Update Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;