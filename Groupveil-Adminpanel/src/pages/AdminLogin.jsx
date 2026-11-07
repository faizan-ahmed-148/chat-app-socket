import React, { useState } from 'react';
import { LockClosedIcon } from '@heroicons/react/24/solid';

const AdminLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const BASE_URL = import.meta.env.VITE_API_BASE_URL
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BASE_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store admin credentials for API calls
        localStorage.setItem('adminCredentials', JSON.stringify({ username, password }));
        onLogin({ username, password });
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="flex flex-col items-center">
            <div className="bg-sky-100 p-3 rounded-full mb-4">
              <LockClosedIcon className="h-8 w-8 text-sky-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-sky-800 mb-1">Admin Login</h1>
            
            <p className="text-sm text-sky-600 mb-6">
              Enter your admin credentials to access the dashboard
            </p>

            {error && (
              <div className="w-full mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full">
              <div className="mb-4">
                <label htmlFor="username" className="block text-sm font-medium text-sky-700 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="password" className="block text-sm font-medium text-sky-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-sky-600 cursor-pointer hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Login'}
              </button>
            </form>

            {/* <p className="text-xs text-sky-500 mt-6">
              Default credentials: adadmin123min / 
            </p> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;