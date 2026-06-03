export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  avatar: string | null;
}
