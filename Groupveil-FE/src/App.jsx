import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import {  useAuth } from "./context/AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Workspace from "./pages/Workspace";
import GroupChat from "./pages/GroupChat";
import CreateGroup from "./pages/CreateGroup";
import Chat from "./components/Chat/Chat";

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
   const { dispatch } = useAuth();
   const token = localStorage.getItem("token")
   console.log(token,'token');
  const BASE_URL = import.meta.env.VITE_API_BASE_URL
   
  const fetchAuth = async () => {

    try {
      const endpoint = "/auth/me";
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      dispatch({ type: "LOGIN", payload: data });
    } catch (error) {
      console.error(error, 'auth - error');
      localStorage.removeItem("token");
    }
  };
useEffect(()=>{
  if(token){
    fetchAuth()
  }
},[token])
  return (
    <div class="bg-gradient-to-br from-indigo-300 via-indigo-600 to-indigo-900

" >
      <Router>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/chat" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Chat /></PrivateRoute>} />
          <Route path="/groups/create" element={<PrivateRoute><CreateGroup /></PrivateRoute>} />
          <Route path="/groups/:groupId" element={<PrivateRoute><GroupChat /></PrivateRoute>} />
        </Routes>
      </Router>
      </div>
   
  );
}

export default App;
