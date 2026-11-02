import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { graphqlRequest, REFRESH_MUTATION, type IRefreshResult } from '@/lib/auth/backend';
import type { IAuthUser } from '@/lib/auth/types';

const REFRESH_COOKIE = 'poc_refresh';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: REFRESH_MAX_AGE,
};

export async function POST(): Promise<NextResponse> {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: 'No session' }, { status: 401 });
  }

  try {
    const data = await graphqlRequest<IRefreshResult>(REFRESH_MUTATION, { refreshToken });
    const refreshed = data.refreshToken;
    const user: IAuthUser = refreshed.user ?? { _id: '', role: 'USER' };

    const response = NextResponse.json({
      token: refreshed.token,
      tokenExpiration: refreshed.tokenExpiration ?? 3600,
      user,
    });

    if (refreshed.refreshToken) {
      response.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, cookieOptions);
    }
    return response;
  } catch {
    const response = NextResponse.json({ message: 'Session expired' }, { status: 401 });
    response.cookies.set(REFRESH_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return response;
  }
}
