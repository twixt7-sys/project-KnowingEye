export type AuthRole = 'ADMIN' | 'EXAMINEE';

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  role: AuthRole;
}
