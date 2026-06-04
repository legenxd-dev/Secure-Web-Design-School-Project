import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ThreadsPage from './pages/ThreadsPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import InboxPage from './pages/InboxPage';
import InboxDetailPage from './pages/InboxDetailPage';
import ScanPage from './pages/ScanPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/threads" element={<ThreadsPage />} />
            <Route path="/threads/:type/:id" element={<ThreadDetailPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/inbox/:id" element={<InboxDetailPage />} />
            <Route path="/messages" element={<Navigate to="/threads" replace />} />
            <Route path="/messages/:id" element={<ThreadDetailPage />} />
            <Route path="/files" element={<Navigate to="/threads" replace />} />
            <Route path="/files/:id" element={<ThreadDetailPage />} />
            <Route path="/scan" element={<ScanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
