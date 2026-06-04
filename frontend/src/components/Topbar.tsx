import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { applyTheme, getInitialTheme, type Theme } from '../utils/theme';
import styles from './Topbar.module.css';

type ActivePage = 'profile' | 'threads' | 'inbox' | 'scan' | 'messages' | 'files';

interface Props {
  active: ActivePage;
}

export default function Topbar({ active }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className={styles.brandName}>secdev</span>
        </div>

        <nav className={styles.nav}>
          <button className={active === 'profile' ? styles.navActive : styles.navItem} onClick={() => navigate('/profile')}>Profile</button>
          <button className={active === 'threads' ? styles.navActive : styles.navItem} onClick={() => navigate('/threads')}>Threads</button>
          <button className={active === 'inbox' ? styles.navActive : styles.navItem} onClick={() => navigate('/inbox')}>Inbox</button>
          <button className={active === 'scan' ? styles.navActive : styles.navItem} onClick={() => navigate('/scan')}>File Scanner</button>
        </nav>

        <div className={styles.right}>
          <button
            className={styles.themeBtn}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <span className={styles.username}>{user?.username}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </header>
  );
}
