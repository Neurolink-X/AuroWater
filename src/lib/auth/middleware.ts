import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from './jwt';

export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, user: any) => Promise<NextResponse>,
  requiredRole?: string
): Promise<NextResponse> {
  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }

  if (requiredRole && decoded.role !== requiredRole) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  return handler(req, decoded);
}
