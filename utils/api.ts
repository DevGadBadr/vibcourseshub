import Constants from 'expo-constants';
import { appStorage as storage } from './storage';

export const API_URL = (Constants.expoConfig?.extra as any)?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://devgadbadr.com/vibapi';

export class ApiError extends Error {
  status: number;
  details?: any;
  constructor(message: string, status: number, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function toHumanValidation(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  const mapOne = (m: string) => {
    const msg = m.toLowerCase();
    if (msg.includes('email must be an email')) return 'Please enter correct email address.';
    if (msg.includes('must be a')) return m; // generic
    return m.charAt(0).toUpperCase() + m.slice(1);
  };
  return messages.map(mapOne).join('\n');
}

export async function api<T>(path: string, init?: RequestInit & { auth?: boolean }) {
  const headers: Record<string, string> = {};
  let access = await storage.getItem('accessToken');
  if (init?.auth && access) headers['Authorization'] = `Bearer ${access}`;
  // Only set JSON content-type if body isn't FormData
  const isFormData = (init?.body && typeof FormData !== 'undefined' && init.body instanceof FormData);
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && init?.auth) {
    // try refresh
    const rt = await storage.getItem('refreshToken');
    if (!rt) throw new Error('Unauthorized');
    const r = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!r.ok) throw new Error('Unauthorized');
    const data = await r.json();
    if (data?.accessToken) await storage.setItem('accessToken', data.accessToken);
    if (data?.refreshToken) await storage.setItem('refreshToken', data.refreshToken);
    access = data?.accessToken;
    const retryHeaders = { ...headers, Authorization: `Bearer ${access}` };
  const retry = await fetch(`${API_URL}${path}`, { ...init, headers: retryHeaders });
    if (!retry.ok) throw new Error(await retry.text());
    return (await retry.json()) as T;
  }
  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch {}
    const validationMsg = toHumanValidation(payload?.message);
    let message: string | undefined = validationMsg || payload?.message;
    if (!message) message = res.statusText || 'Request failed';
    throw new ApiError(message, res.status, payload);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// Convenience client for course reordering
export async function reorderCourses(items: { id: number; position: number }[]) {
  return api('/courses/reorder/bulk', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ items }),
  } as any);
}

// Upload profile avatar
export async function uploadAvatar(form: FormData) {
  return api('/auth/avatar', {
    method: 'POST',
    auth: true,
    body: form,
  } as any);
}

export async function removeAvatar() {
  return api('/auth/avatar', {
    method: 'DELETE',
    auth: true,
  } as any);
}

// Management types and helpers
export type ManagedUser = {
  id: number;
  name?: string | null;
  email: string;
  role: 'TRAINEE' | 'INSTRUCTOR' | 'ADMIN' | 'MANAGER';
  avatarUrl?: string | null;
};

export type CourseSummary = { id: number; slug?: string; title: string; thumbnailUrl?: string | null; isPublished?: boolean; isFeatured?: boolean };

export type ManagedUserDetail = {
  id: number;
  name?: string | null;
  email: string;
  role: ManagedUser['role'];
  avatarUrl?: string | null;
  enrollments: Array<{ courseId: number; course: CourseSummary }>;
};

export async function mgmtListUsers(): Promise<ManagedUser[]> {
  return api('/management/users', { method: 'GET', auth: true } as any);
}

export async function mgmtGetUser(id: number): Promise<ManagedUserDetail> {
  return api(`/management/users/${id}`, { method: 'GET', auth: true } as any);
}

export async function mgmtListCourses(): Promise<CourseSummary[]> {
  return api('/management/courses', { method: 'GET', auth: true } as any);
}
export async function setCoursePublish(slug: string, isPublished: boolean) {
  return api(`/courses/${slug}`, { method: 'PUT', auth: true, body: JSON.stringify({ isPublished }) } as any);
}

export async function mgmtSetUserRole(id: number, role: ManagedUser['role']): Promise<ManagedUser> {
  return api(`/management/users/${id}/role`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ role }),
  } as any);
}

export async function mgmtDeleteUser(id: number): Promise<{ ok: boolean }> {
  return api(`/management/users/${id}`, { method: 'DELETE', auth: true } as any);
}

export async function mgmtAddEnrollment(id: number, courseId: number): Promise<{ ok: boolean }> {
  return api(`/management/users/${id}/enrollments`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ courseId }),
  } as any);
}

export async function mgmtRemoveEnrollment(id: number, courseId: number): Promise<{ ok: boolean }> {
  return api(`/management/users/${id}/enrollments/${courseId}`, { method: 'DELETE', auth: true } as any);
}
