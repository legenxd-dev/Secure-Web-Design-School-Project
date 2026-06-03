import styles from './UserAvatar.module.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.PROD ? window.location.origin : 'http://localhost:4000'
);
const AVATAR_BASE = `${apiBaseUrl}/uploads/avatars/`;

interface Props {
  username: string;
  avatar?: string | null;
  className: string;
}

export default function UserAvatar({ username, avatar, className }: Props) {
  return (
    <div className={className}>
      {avatar ? (
        <img
          src={`${AVATAR_BASE}${encodeURIComponent(avatar)}`}
          alt={`${username} avatar`}
          className={styles.image}
        />
      ) : (
        username[0]?.toUpperCase()
      )}
    </div>
  );
}
