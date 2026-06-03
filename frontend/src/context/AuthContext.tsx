import {
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { User } from '../types';
import apiClient from '../api/client';
import { AuthContext } from './AuthContextState';

const PUBLIC_AUTH_PATHS = new Set(['/login', '/register']);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !PUBLIC_AUTH_PATHS.has(window.location.pathname));

  useEffect(() => {
    if (PUBLIC_AUTH_PATHS.has(window.location.pathname)) {
      return;
    }

    apiClient.get<User>('/api/users/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handle = () => setUser(null);
    window.addEventListener('auth:unauthorized', handle);
    return () => window.removeEventListener('auth:unauthorized', handle);
  }, []);

  const login = useCallback((newUser: User) => {
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updated: User) => {
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
