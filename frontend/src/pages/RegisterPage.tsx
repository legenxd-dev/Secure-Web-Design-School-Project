import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { REDIRECT_DELAY_MS } from '../constants/limits';
import styles from './Auth.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!username.trim() || !email.trim() || !password || !confirm) {
      setError('All fields are required');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/auth/register', { username, email, password });
      setSuccess('Account created! Redirecting…');
      setTimeout(() => navigate('/login'), REDIRECT_DELAY_MS);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } };
      const data = axiosErr.response?.data;
      if (data?.errors?.length) setError(data.errors[0]);
      else if (data?.error) setError(data.error);
      else setError('Registration failed. Please try again.');
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
          <h1 className={styles.title}>Create account</h1>
          <p className={styles.subtitle}>Join the security platform</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="john_doe"
                disabled={loading}
              />
            </div>
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
                autoComplete="new-password"
                placeholder="min. 12 characters"
                disabled={loading}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="repeat password"
                disabled={loading}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Creating account…' : 'Register'}
            </button>
          </form>

          <p className={styles.footer}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
