import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import LoginPage from './features/auth/pages/LoginPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import ChatPage from './features/chat/pages/ChatPage';
import DocumentPage from './features/documents/pages/DocumentPage';
import SystemPage from './features/system/pages/SystemPage';
import AppLayout from './components/layout/AppLayout';
import { useAuthStore } from './store/auth-store';

const theme = createTheme({
  colors: {
    gaziBlue: [
      '#f0f4f9', // 0: acik mavi tonu
      '#dbe5f2', // 1
      '#b8cbe5', // 2
      '#90acd5', // 3
      '#648bc2', // 4
      '#436fab', // 5
      '#32568d', // 6
      '#264270', // 7
      '#1b365d', // 8: Gazi Lacivert
      '#11223c', // 9
    ]
  },
  primaryColor: 'gaziBlue',
  fontFamily: 'Inter, sans-serif',
});

// Giriş Kontrol Guard'ı (Protected Route)
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ 
  children, 
  allowedRoles 
}) => {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

export const App: React.FC = () => {
  return (
    <MantineProvider theme={theme}>
      <Notifications position="top-right" zIndex={2000} />
      <BrowserRouter>
        <Routes>
          {/* Public Rotalar */}
          <Route path="/login" element={<LoginPage />} />

          {/* Korunan Rotalar (Authenticated Routes) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat" 
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/documents" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'editor']}>
                <DocumentPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/system" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SystemPage />
              </ProtectedRoute>
            } 
          />

          {/* Varsayılan Yönlendirme */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
};

export default App;
