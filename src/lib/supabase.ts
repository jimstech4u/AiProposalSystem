import { appConfig, assertConfigured } from './config';

export type AppRole = 'engineer' | 'project-manager' | 'sales' | 'admin';

export type UserSession = {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, any>;
  };
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  employee_id?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  role: AppRole;
  avatar_url?: string | null;
  is_active?: boolean;
};

function headers(token?: string) {
  assertConfigured('supabaseAnonKey');

  return {
    apikey: appConfig.supabaseAnonKey,
    Authorization: `Bearer ${token ?? getStoredAccessToken() ?? appConfig.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

function authUrl(path: string) {
  assertConfigured('supabaseUrl');
  return `${appConfig.supabaseUrl}/auth/v1${path}`;
}

function restUrl(path: string) {
  assertConfigured('supabaseRestUrl');
  return `${appConfig.supabaseRestUrl}${path}`;
}

export async function signInWithPassword(email: string, password: string) {
  const response = await fetch(authUrl('/token?grant_type=password'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to sign in.');
  }

  return (await response.json()) as UserSession;
}

export async function signOut(token?: string) {
  const response = await fetch(authUrl('/logout'), {
    method: 'POST',
    headers: headers(token),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to sign out.');
  }
}

export async function getUserProfile(userId: string, token?: string) {
  const response = await fetch(restUrl(`/user_profiles?select=*&id=eq.${userId}`), {
    method: 'GET',
    headers: headers(token),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to load user profile.');
  }

  return (await response.json()) as UserProfile[];
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  companyName?: string;
  phone?: string;
  employeeId?: string;
  jobTitle?: string;
  department?: string;
}) {
  const response = await fetch(authUrl('/signup'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        full_name: input.fullName,
        role: input.role,
        company_name: input.companyName,
        phone: input.phone,
        employee_id: input.employeeId,
        job_title: input.jobTitle,
        department: input.department,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to register account.');
  }

  return (await response.json()) as Partial<UserSession>;
}

export async function requestPasswordRecovery(email: string) {
  const response = await fetch(authUrl('/recover'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to send password recovery code.');
  }
}

export async function verifyEmailOtp(input: {
  email: string;
  token: string;
  type: 'signup' | 'recovery';
}) {
  const response = await fetch(authUrl('/verify'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Invalid or expired verification code.');
  }

  return (await response.json()) as UserSession;
}

export async function updateUserPassword(password: string, token: string) {
  const response = await fetch(authUrl('/user'), {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to update password.');
  }
}

export async function insertRow<T extends Record<string, any>>(table: string, row: T, token?: string) {
  const response = await fetch(restUrl(`/${table}`), {
    method: 'POST',
    headers: {
      ...headers(token),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Unable to insert ${table}.`);
  }

  return (await response.json()) as T[];
}

export async function selectRows<T>(table: string, query = 'select=*', token?: string) {
  const response = await fetch(restUrl(`/${table}?${query}`), {
    method: 'GET',
    headers: headers(token),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Unable to load ${table}.`);
  }

  return (await response.json()) as T[];
}

export async function updateRows<T extends Record<string, any>>(
  table: string,
  match: string,
  changes: Partial<T>,
  token?: string
) {
  const response = await fetch(restUrl(`/${table}?${match}`), {
    method: 'PATCH',
    headers: {
      ...headers(token),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(changes),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Unable to update ${table}.`);
  }

  return (await response.json()) as T[];
}

export async function deleteRows(table: string, match: string, token?: string) {
  const response = await fetch(restUrl(`/${table}?${match}`), {
    method: 'DELETE',
    headers: {
      ...headers(token),
      Prefer: 'return=minimal',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Unable to delete from ${table}.`);
  }
}

export function encodeFilterValue(value: string) {
  return encodeURIComponent(value);
}

export function getStoredAccessToken() {
  if (typeof window === 'undefined') return undefined;

  const raw = window.localStorage.getItem('proposalai:session');
  if (!raw) return undefined;

  try {
    return JSON.parse(raw)?.accessToken as string | undefined;
  } catch {
    return undefined;
  }
}

export function roleFromEmail(email: string): AppRole {
  if (email.includes('manager')) return 'project-manager';
  if (email.includes('sales')) return 'sales';
  if (email.includes('admin')) return 'admin';
  return 'engineer';
}
