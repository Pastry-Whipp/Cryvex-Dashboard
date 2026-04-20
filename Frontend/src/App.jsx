import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Pipelines from './pages/Pipelines';
import CreatePipeline from './pages/CreatePipeline';
import Profile from './pages/Profile';
import MyConfigs from './pages/MyConfigs';
import ConfigEditor from './pages/ConfigEditor';
import Executions from './pages/Executions';
import VerifyIntegrity from './pages/VerifyIntegrity';
import DataExplorer from './pages/DataExplorer';
import SettingsPage from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/pipelines" element={
            <ProtectedRoute>
              <Pipelines />
            </ProtectedRoute>
          } />

          <Route path="/pipelines/create" element={
            <ProtectedRoute>
              <CreatePipeline />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/my-configs" element={
            <ProtectedRoute>
              <MyConfigs />
            </ProtectedRoute>
          } />

          <Route path="/my-configs/:id" element={
            <ProtectedRoute>
              <ConfigEditor />
            </ProtectedRoute>
          } />

          <Route path="/executions" element={
            <ProtectedRoute>
              <Executions />
            </ProtectedRoute>
          } />

          <Route path="/verify-integrity" element={
            <ProtectedRoute>
              <VerifyIntegrity />
            </ProtectedRoute>
          } />

          <Route path="/data-explorer" element={
            <ProtectedRoute>
              <DataExplorer />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />

          <Route path="/audit-logs" element={
            <ProtectedRoute>
              <AuditLogs />
            </ProtectedRoute>
          } />

          <Route path="/admin/users" element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          } />

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 - Redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
