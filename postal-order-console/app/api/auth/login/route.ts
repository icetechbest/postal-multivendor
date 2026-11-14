import { NextResponse } from 'next/server';
import { graphqlRequest, LOGIN_MUTATION, type ILoginResult } from '@/lib/auth/backend';
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

export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  try {
    const data = await graphqlRequest<ILoginResult>(LOGIN_MUTATION, {
      email,
      password,
      // The backend login resolver accepts only email|google|facebook|apple.
      // Admin/staff sign-in is always an email + password login.
      type: 'email',
    });
    const login = data.login;
    const user: IAuthUser = login.user ?? {
      _id: login.userId ?? '',
      email,
      role: login.userType ?? 'USER',
    };

    const response = NextResponse.json({
      token: login.token,
      tokenExpiration: login.tokenExpiration ?? 3600,
      user,
    });

    if (login.refreshToken) {
      response.cookies.set(REFRESH_COOKIE, login.refreshToken, cookieOptions);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid email or password';
    return NextResponse.json({ message }, { status: 401 });
  }
}
