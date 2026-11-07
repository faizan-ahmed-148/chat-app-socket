import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import teamCollaborationImage from "/assets/images/coming-soon.svg"; // Replace with your image path
import creategroupimg from "/creategroup.png"; // Replace with your image path

const CreateGroup = () => {
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_API_BASE_URL

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsPending(true);
    
    try {
      const response = await fetch(`${BASE_URL}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: form.name, description: form.description })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.message && data.message.includes("pending approval")) {
          setIsPending(false);
          setSuccess("Group created successfully and is pending approval. You will be notified once approved.");
        } else {
          setSuccess("Group created successfully!");
          setIsPending(false);
        }
        setTimeout(() => navigate("/dashboard"), 3000);
      } else {
        setIsPending(false);
        setError(data.error || "Failed to create group");
      }
    } catch (err) {
      setIsPending(false);
      setError("Failed to create group");
    }
  };

  return (
    <div className="h-[97vh] overflow-hidden relative flex flex-col md:flex-row bg-gray-50">
      {/* Left Side - Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 xl:w-1/3 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
        <div className="max-w-md w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Group</h1>
            <p className="text-gray-600">Start collaborating with your team members in a dedicated space</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-700 font-medium">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className={`mb-6 p-4 ${isPending ? 'bg-amber-50 border-l-4 border-amber-500' : 'bg-green-50 border-l-4 border-green-500'} rounded`}>
              <div className="flex items-center">
                <svg className={`h-5 w-5 ${isPending ? 'text-amber-500' : 'text-green-500'} mr-3`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className={`${isPending ? 'text-amber-700' : 'text-green-700'} font-medium`}>{success}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name *
                </label>
                <div className="relative">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
                    placeholder="Marketing Team"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={form.description}
                  required
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
                  placeholder="What's the purpose of this group?"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-sky-600 cursor-pointer hover:bg-sky-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                {isPending ? 'Creating Group' : 'Create Group'}
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="w-full cursor-pointer bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 border border-gray-300 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                Back to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden md:block md:w-1/2 lg:w-3/5 xl:w-2/3 bg-sky-600 relative">
        <div className="absolute inset-0 "></div>
        <img 
          src={creategroupimg} 
          alt="Team collaboration" 
          className="w-full h-full object-cover"
        />
        {/* <div className="absolute inset-0 flex items-center justify-center p-12 text-white">
          <div className="max-w-xl">
            <h2 className="text-4xl font-bold mb-4">Collaborate with your team</h2>
            <p className="text-xl mb-6">Create dedicated spaces for your projects, teams, or communities to work together efficiently.</p>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Real-time communication</span>
              </div>
              <div className="flex items-center">
                <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>File sharing</span>
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default CreateGroup;