import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Workspace = () => {
  const [workspace, setWorkspace] = useState(null);
  const [groups, setGroups] = useState([]);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const { token } = useAuth();
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

  useEffect(() => {
    fetchWorkspace();
    fetchGroups();
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setWorkspace(data);
      }
    } catch (error) {
      setError("Failed to fetch workspace");
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/workspace/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setGroups(data);
      }
    } catch (error) {
      setError("Failed to fetch groups");
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...newGroup, workspaceId })
      });

      if (response.ok) {
        setNewGroup({ name: "", description: "" });
        fetchGroups();
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (error) {
      setError("Failed to create group");
    }
  };

  if (!workspace) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", padding: "20px" }}>
      <h2>Workspace</h2>
      <p>Group creation is now available on the Create/Join Group page.</p>
    </div>
  );
};

export default Workspace;
