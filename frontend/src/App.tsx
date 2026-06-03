import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';
import MessageDetailPage from './pages/MessageDetailPage';
import FilesPage from './pages/FilesPage';
import FileDetailPage from './pages/FileDetailPage';
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
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:id" element={<MessageDetailPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/files/:id" element={<FileDetailPage />} />
            <Route path="/scan" element={<ScanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
