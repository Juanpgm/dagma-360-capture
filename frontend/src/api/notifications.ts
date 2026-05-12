/**
 * Notifications API client — admin endpoints.
 *
 * Backend routes:
 *  - POST /admin/notifications/broadcast
 *  - POST /admin/notifications/test
 *  - GET  /admin/notifications/health
 *
 * Auth: requires admin+ role. `ApiClient` inyecta el Bearer token Firebase.
 */
import { ApiClient } from '../lib/api-client';

export type AnnouncementPriority = 'info' | 'warning' | 'urgent';

export interface BroadcastPayload {
  subject: string;
  message_html: string;
  /** all | lideres | grupo:<nombre> | uids:uid1,uid2 | emails:a@b.com,c@d.com */
  audience: string;
  priority?: AnnouncementPriority;
  cta_url?: string;
  cta_label?: string;
}

export interface BroadcastResponse {
  success: boolean;
  audience: string;
  recipients_count: number;
  status: 'queued' | string;
}

export interface NotificationsHealth {
  smtp_configured: boolean;
  gmail_api_configured: boolean;
  active_channel: 'gmail_api' | 'smtp' | 'none';
  sender: string | null;
  sent_last_24h?: number;
  quota_limit_24h?: number;
  quota_remaining_24h?: number | null;
  errors?: string[];
  [k: string]: any;
}

export interface TestEmailResponse {
  sent: boolean;
  to: string;
}

export async function broadcastAnnouncement(payload: BroadcastPayload): Promise<BroadcastResponse> {
  return ApiClient.post<BroadcastResponse>('/admin/notifications/broadcast', payload);
}

export async function getNotificationsHealth(): Promise<NotificationsHealth> {
  return ApiClient.get<NotificationsHealth>('/admin/notifications/health', { cacheMs: 30_000 });
}

export async function sendTestEmail(to?: string): Promise<TestEmailResponse> {
  const path = to ? `/admin/notifications/test?to=${encodeURIComponent(to)}` : '/admin/notifications/test';
  return ApiClient.post<TestEmailResponse>(path, {});
}
