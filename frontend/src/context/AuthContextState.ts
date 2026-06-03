import { createContext } from 'react';
import type { User } from '../types';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
