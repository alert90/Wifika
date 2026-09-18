// src/lib/apiAuth.ts
import { getServerSession, Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { hasPermission, isSuperAdmin } from './permissions';

export type AuthOk = {
  authorized: true;
  session: Session;
  userId: string;
};

export type AuthFail = {
  authorized: false;
  response: NextResponse;
};

export async function checkAuth(): Promise<AuthOk | AuthFail> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    userId: session.user.id,
  };
}

export async function checkPermission(
  userId: string,
  permissionKey: string
): Promise<{ authorized: true } | AuthFail> {
  const isSuper = await isSuperAdmin(userId);
  if (isSuper) return { authorized: true };

  const hasAccess = await hasPermission(userId, permissionKey);
  if (!hasAccess) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}

export async function requirePermission(
  permissionKey: string
): Promise<AuthOk | AuthFail> {
  const auth = await checkAuth();
  if (!auth.authorized) return auth;

  const perm = await checkPermission(auth.userId, permissionKey);
  if (!perm.authorized) return perm;

  return auth;
}