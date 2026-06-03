import styles from './UserAvatar.module.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.PROD ? window.location.origin : 'http://localhost:4000'
);
const AVATAR_BASE = `${apiBaseUrl}/uploads/avatars/`;

function avatarUrl(avatar: string): string {
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  return `${AVATAR_BASE}${encodeURIComponent(avatar)}`;
}

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
          src={avatarUrl(avatar)}
          alt={`${username} avatar`}
          className={styles.image}
        />
      ) : (
        username[0]?.toUpperCase()
      )}
    </div>
  );
}
