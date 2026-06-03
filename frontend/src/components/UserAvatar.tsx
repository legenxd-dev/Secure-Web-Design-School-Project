import styles from './UserAvatar.module.css';
import { apiBaseUrl } from '../config/api';

const AVATAR_BASE = `${apiBaseUrl()}/uploads/avatars/`;

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
