import styles from './UserAvatar.module.css';

const AVATAR_BASE = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'}/uploads/avatars/`;

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
