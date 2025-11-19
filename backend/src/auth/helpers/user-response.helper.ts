/**
 * Helper to format user response consistently
 */
export function formatUserResponse(user: {
  id: number;
  email: string;
  name?: string | null;
  title?: string | null;
  role: string;
  createdAt: Date;
  loginCount: number;
  isEmailVerified: boolean;
  avatarUrl?: string | null;
  provider?: string | null;
  googlePicture?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    title: user.title ?? undefined,
    role: user.role,
    createdAt: user.createdAt,
    loginCount: user.loginCount,
    isEmailVerified: user.isEmailVerified,
    avatarUrl: user.avatarUrl,
    provider: user.provider || 'local',
    googlePicture: user.googlePicture,
  };
}

