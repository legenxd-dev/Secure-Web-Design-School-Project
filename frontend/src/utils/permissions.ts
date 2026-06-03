import type { User } from '../types';

export function canModerate(user: User | null, ownerId: number): boolean {
  return user?.role === 'admin' || user?.id === ownerId;
}
