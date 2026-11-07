import React, { useState, useEffect } from 'react';
import AdminPanel from './pages/AdminPanel';
import AdminLogin from './pages/AdminLogin';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState(null);

  useEffect(() => {
    // Check if admin is already logged in
    const savedCredentials = localStorage.getItem('adminCredentials');
    if (savedCredentials) {
      const credentials = JSON.parse(savedCredentials);
      setAdminCredentials(credentials);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (credentials) => {
    setAdminCredentials(credentials);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setAdminCredentials(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminPanel adminCredentials={adminCredentials} onLogout={handleLogout} />;
}

export default App; 