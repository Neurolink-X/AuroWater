import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from './jwt';

type AuthenticatedUser = NonNullable<ReturnType<typeof verifyToken>>;

export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  requiredRole?: string
): Promise<NextResponse> {
  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (requiredRole && decoded.role !== requiredRole) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  return handler(req, decoded);
}
