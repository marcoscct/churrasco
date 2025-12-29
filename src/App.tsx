
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BarbecueManager } from './pages/BarbecueManager';
import { useAuth } from './contexts/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Carregando...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* 
          Basename note: 
          If deployed to marcoscct.github.io/churrasco, basename should be '/churrasco'.
          If running locally on root, it might be separate.
          Ideally we detect valid basename or rely on HashRouter if easier? 
          BrowserRouter is cleaner but requires GitHub Pages '404 hack' or correct navigation.
          Let's stick to BrowserRouter but we might need to be careful with basepath.
          The User previously set base: '/churrasco/' in vite.config.ts.
       */}
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/churrasco/:id" element={
          <ProtectedRoute>
            <BarbecueManager />
          </ProtectedRoute>
        } />

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
