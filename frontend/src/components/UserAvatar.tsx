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

function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export default function UserAvatar({ username, avatar, className }: Props) {
  if (avatar) {
    return (
      <div className={className}>
        <img src={avatarUrl(avatar)} alt={`${username} avatar`} className={styles.image} />
      </div>
    );
  }

  const hue = hueFromName(username || '?');
  const colorStyle = { background: `hsl(${hue} 48% 42%)`, color: '#fff', border: 'none' };

  return (
    <div className={className} style={colorStyle}>
      {username[0]?.toUpperCase()}
    </div>
  );
}
