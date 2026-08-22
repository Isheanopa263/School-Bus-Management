import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import "./AppLayout.css";

export default function AppLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading)
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <TopNav onMenuToggle={() => setSidebarOpen(true)} />
      <div className="app-layout">
        <Sidebar />
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <main className="content-area">
          <div className="main-content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
