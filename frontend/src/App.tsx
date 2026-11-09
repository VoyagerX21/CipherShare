import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ShareFilePage } from './pages/ShareFilePage';
import { SentFilesPage } from './pages/SentFilesPage';
import { SecurityCenterPage } from './pages/SecurityCenterPage';
import { KeyManagementPage } from './pages/KeyManagementPage';
import { DemoWorkspacePage } from './pages/DemoWorkspacePage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center gap-3">
          <span className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium text-slate-700">Initializing CipherShare cryptographic session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing route */}
          <Route path="/" element={<LandingPage />} />

          {/* Protected Workspace routes wrapped in AppLayout */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/share"
            element={
              <ProtectedRoute>
                <ShareFilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/inbox" element={<Navigate to="/demo" replace />} />
          <Route path="/playground" element={<Navigate to="/demo" replace />} />
          <Route
            path="/sent"
            element={
              <ProtectedRoute>
                <SentFilesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security"
            element={
              <ProtectedRoute>
                <SecurityCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/keys"
            element={
              <ProtectedRoute>
                <KeyManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/demo"
            element={
              <ProtectedRoute>
                <DemoWorkspacePage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
