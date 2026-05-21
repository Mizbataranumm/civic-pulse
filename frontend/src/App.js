import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Transparency from "@/pages/Transparency";
import CitizenDashboard from "@/pages/CitizenDashboard";
import OfficialDashboard from "@/pages/OfficialDashboard";
import SupervisorDashboard from "@/pages/SupervisorDashboard";
import ReportIssue from "@/pages/ReportIssue";
import MyIssues from "@/pages/MyIssues";
import IssueDetail from "@/pages/IssueDetail";
import CityMap from "@/pages/CityMap";
import AllIssues from "@/pages/AllIssues";
import Officials from "@/pages/Officials";

import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

const RoleDashboard = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "official") return <OfficialDashboard />;
  if (user.role === "supervisor") return <SupervisorDashboard />;
  return <CitizenDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" theme="dark" />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/transparency" element={<Transparency />} />

          <Route path="/app" element={<ProtectedRoute><AppLayout><RoleDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/report" element={<ProtectedRoute><AppLayout><ReportIssue /></AppLayout></ProtectedRoute>} />
          <Route path="/app/my-issues" element={<ProtectedRoute><AppLayout><MyIssues /></AppLayout></ProtectedRoute>} />
          <Route path="/app/issues/:id" element={<ProtectedRoute><AppLayout><IssueDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/app/map" element={<ProtectedRoute><AppLayout><CityMap /></AppLayout></ProtectedRoute>} />
          <Route path="/app/queue" element={<ProtectedRoute roles={["official","supervisor"]}><AppLayout><OfficialDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/all-issues" element={<ProtectedRoute roles={["supervisor","official"]}><AppLayout><AllIssues /></AppLayout></ProtectedRoute>} />
          <Route path="/app/officials" element={<ProtectedRoute roles={["supervisor"]}><AppLayout><Officials /></AppLayout></ProtectedRoute>} />
          <Route path="/app/analytics" element={<ProtectedRoute roles={["supervisor"]}><AppLayout><SupervisorDashboard /></AppLayout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
