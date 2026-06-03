import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import type { User } from '../types';
import styles from './Auth.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const notice = (location.state as { message?: string } | null)?.message;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ user: User }>('/api/auth/login', { email, password });
      login(res.data.user);
      navigate('/profile');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.brand}>
          <svg className={styles.brandIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className={styles.brandName}>secdev</span>
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>Access your security dashboard</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {notice && !error && <p className={styles.success}>{notice}</p>}
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className={styles.footer}>
            No account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
