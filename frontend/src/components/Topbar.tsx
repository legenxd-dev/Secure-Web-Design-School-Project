import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import styles from './Topbar.module.css';

type ActivePage = 'profile' | 'threads' | 'inbox' | 'scan' | 'messages' | 'files';

interface Props {
  active: ActivePage;
}

export default function Topbar({ active }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login');
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
          <button className={active === 'inbox' ? styles.navActive : styles.navItem} onClick={() => navigate('/inbox')}>DM Inbox</button>
          <button className={active === 'scan' ? styles.navActive : styles.navItem} onClick={() => navigate('/scan')}>File Scanner</button>
        </nav>

        <div className={styles.right}>
          <span className={styles.username}>{user?.username}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </header>
  );
}
