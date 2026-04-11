import { User } from '../../users/domain/user';

export class Session {
  id: string;
  userId: string;
  user: User;
  hash: string;
  ipAddress: string | null;
  terminalId: string | null;
  expiresAt: Date;
  createdAt: Date;
}
