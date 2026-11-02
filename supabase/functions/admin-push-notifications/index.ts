import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

// Admin entry point for push notifications. It never talks to Expo itself any more:
// it records the notification, turns the audience into queue rows (push_enqueue_recipients),
// wakes the push-broadcast-worker and returns straight away. The worker sends at the chosen pace.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendPushNotificationRequest {
  action: 'send_notification' | 'send_reengagement' | 'send_test';
  title?: string;
  body?: string;
  data?: Record<string, any>;
  target_type?: 'all' | 'individual' | 'segment';
  target_user_ids?: string[];
  target_segment_id?: string;
  personalize?: boolean;
  notification_type?: string;
  notification_category?: string;
  category?: string;
  /** devices per minute, 100 to 6000 (default 1000) */
  rate_per_minute?: number;
  /** only users who have marketing alerts on (default false) */
  respect_marketing_pref?: boolean;
  /** newest N devices per user (default 3, 1 to 10) */
  max_tokens_per_user?: number;
  /** client generated uuid: a repeated request returns the first send instead of sending twice */
  request_id?: string;
}

const REENGAGEMENT_TEMPLATES: Record<string, any> = {
  zero_balance_reminder: {
    title: '💰 Your Wallet Needs Attention',
    body: 'Your wallet balance is empty. Add funds to start saving again and reach your goals!',
    data: { type: 'zero_balance_reminder', screen: 'Wallet', action: 'deposit' },
  },
  vault_unfunded_reminder: {
    title: '🏦 Your Vault is Waiting',
    body: 'Fund your vault to activate automatic savings and watch your money grow!',
    data: { type: 'vault_unfunded_reminder', screen: 'Vaults', action: 'fund_vault' },
  },
  deposit_no_plan: {
    title: '📋 Complete Your Setup',
    body: "You've deposited funds but haven't created a savings plan yet. Create one now to start earning!",
    data: { type: 'deposit_no_plan', screen: 'CreatePlan', action: 'create_plan' },
  },
  no_plan_yet: {
    title: '👋 Welcome to PlanMoni!',
    body: 'Complete your setup by creating your first savings plan and start your journey to financial freedom.',
    data: { type: 'no_plan_yet', screen: 'CreatePlan', action: 'create_plan' },
  },
  re_engagement: {
    title: '🌟 We Miss You!',
    body: "It's been a while since your last visit. Come back and continue your savings journey with PlanMoni!",
    data: { type: 're_engagement', screen: 'Dashboard', action: 'open_app' },
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function truncateString(str: string, maxLength: number): string {
  if (!str || typeof str !== 'string') return '';
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

function cleanDataObject(data: any): any {
  if (!data || typeof data !== 'object') return {};

  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      cleaned[key] = truncateString(value, 100);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      cleaned[key] = value;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) => (typeof item === 'string' ? truncateString(item, 100) : item));
    } else if (value && typeof value === 'object') {
      cleaned[key] = cleanDataObject(value);
    }
  }
  return cleaned;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Sending needs notifications.send or notifications.create; viewing history also allows notifications.view. */
async function hasNotificationPermission(supabaseAuth: any, write: boolean): Promise<boolean> {
  const { data: isSuperAdmin } = await supabaseAuth.rpc('is_super_admin');
  if (isSuperAdmin) return true;

  const names = write ? ['notifications.send', 'notifications.create'] : ['notifications.view', 'notifications.send', 'notifications.create'];
  for (const permission_name of names) {
    const { data } = await supabaseAuth.rpc('has_permission', { permission_name });
    if (data) return true;
  }
  return false;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const isWrite = req.method === 'POST';

    if (!(await hasNotificationPermission(supabaseAuth, isWrite))) {
      throw new Error('Unauthorized: Notification permissions required');
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const notificationId = url.searchParams.get('notification_id');
      if (!notificationId) {
        return json({ error: 'notification_id required' }, 400);
      }

      const { data: notification, error } = await supabase.from('push_notifications').select('*').eq('id', notificationId).single();
      if (error) throw error;

      const { data: logs } = await supabase
        .from('push_notification_logs')
        .select('*')
        .eq('push_notification_id', notificationId)
        .order('created_at', { ascending: false })
        .limit(1000);

      return json({ notification, logs });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const body: SendPushNotificationRequest = await req.json();

    let title: string;
    let messageBody: string;
    let data: Record<string, any>;
    let targetType: 'all' | 'individual' | 'segment';
    let targetUserIds: string[] | null = null;
    let segmentId: string | null = null;
    let notificationType: string;
    let category: string | null = null;
    let personalize = false;
    let respectMarketing = body.respect_marketing_pref === true;
    let maxTokens = clampInt(body.max_tokens_per_user, 1, 10, 3);
    const rate = clampInt(body.rate_per_minute, 100, 6000, 1000);

    if (body.action === 'send_reengagement') {
      const template = body.category ? REENGAGEMENT_TEMPLATES[body.category] : undefined;
      if (!body.category || !template) {
        return json({ error: 'Invalid re-engagement category' }, 400);
      }
      title = template.title;
      messageBody = template.body;
      data = template.data;
      // the audience is resolved by the category inside the database (no row limit)
      targetType = 'individual';
      targetUserIds = null;
      notificationType = 'reengagement';
      category = body.category;
    } else if (body.action === 'send_test') {
      if (!body.title || !body.body) throw new Error('Title and body are required');
      title = body.title;
      messageBody = body.body;
      data = body.data ?? {};
      targetType = 'individual';
      targetUserIds = [user.id];
      notificationType = 'manual';
      category = 'test';
      personalize = body.personalize === true;
      respectMarketing = false;
      maxTokens = 10; // a test goes to all of the admin's own devices
    } else if (body.action === 'send_notification') {
      if (!body.title || !body.body) throw new Error('Title and body are required');
      title = body.title;
      messageBody = body.body;
      data = body.data ?? {};
      targetType = body.target_type ?? 'all';
      if (!['all', 'individual', 'segment'].includes(targetType)) return json({ error: 'Invalid target type' }, 400);
      if (targetType === 'individual') {
        targetUserIds = (body.target_user_ids ?? []).filter((id) => UUID_RE.test(id));
        if (targetUserIds.length === 0) return json({ error: 'Select at least one user' }, 400);
      }
      if (targetType === 'segment') {
        if (!body.target_segment_id || !UUID_RE.test(body.target_segment_id)) return json({ error: 'Select a segment' }, 400);
        segmentId = body.target_segment_id;
      }
      // 'reengagement' with explicit users = the single-user alert sent from the user's page
      notificationType = ['manual', 'system', 'marketing', 'reengagement'].includes(body.notification_type ?? '') ? body.notification_type! : 'manual';
      if (notificationType === 'reengagement' && (targetType !== 'individual' || !(body.notification_category && REENGAGEMENT_TEMPLATES[body.notification_category]))) {
        notificationType = 'manual';
      }
      category = body.notification_category || null;
      personalize = body.personalize === true;
    } else {
      return json({ error: 'Invalid action' }, 400);
    }

    const requestId = body.request_id && UUID_RE.test(body.request_id) ? body.request_id : null;

    // a repeated request (double click, retry after a timeout) returns the first send
    if (requestId) {
      const { data: existing } = await supabase
        .from('push_notifications')
        .select('id, status, total_recipients')
        .eq('request_id', requestId)
        .maybeSingle();
      if (existing) {
        return json({
          success: true,
          duplicate: true,
          notification_id: existing.id,
          status: existing.status,
          queued: existing.total_recipients,
          message: 'This notification was already submitted',
        });
      }
    }

    const { data: notificationRecord, error: notifError } = await supabase
      .from('push_notifications')
      .insert({
        title: truncateString(title, 100),
        body: truncateString(messageBody, 200),
        data: cleanDataObject(data),
        target_type: targetType,
        target_user_ids: targetUserIds,
        target_segment_id: segmentId,
        status: 'draft',
        created_by: user.id,
        notification_type: notificationType,
        notification_category: category,
        personalize,
        respect_marketing_pref: respectMarketing,
        rate_per_minute: rate,
        max_tokens_per_user: maxTokens,
        request_id: requestId,
      })
      .select('id')
      .single();

    if (notifError) {
      // two simultaneous requests with the same request_id: the unique index rejects the second
      if (requestId && notifError.code === '23505') {
        const { data: existing } = await supabase.from('push_notifications').select('id, status, total_recipients').eq('request_id', requestId).maybeSingle();
        if (existing) {
          return json({ success: true, duplicate: true, notification_id: existing.id, status: existing.status, queued: existing.total_recipients });
        }
      }
      throw notifError;
    }

    const { data: enqueue, error: enqueueError } = await supabase.rpc('push_enqueue_recipients', {
      p_notification_id: notificationRecord.id,
    });

    if (enqueueError) {
      await supabase
        .from('push_notifications')
        .update({ status: 'failed', error: truncateString(enqueueError.message, 300), sent_at: new Date().toISOString() })
        .eq('id', notificationRecord.id);
      return json({ success: false, notification_id: notificationRecord.id, error: enqueueError.message }, 400);
    }

    if (!enqueue || enqueue.devices_queued === 0) {
      return json(
        {
          success: false,
          notification_id: notificationRecord.id,
          error: 'No eligible devices for the selected audience (users with notifications on and an active device)',
          audience: enqueue,
        },
        400,
      );
    }

    // wake the worker now instead of waiting for the next minute tick
    const kick = fetch(`${supabaseUrl}/functions/v1/push-broadcast-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: notificationRecord.id }),
    }).catch((e) => console.error('worker kick failed (cron will pick it up):', e));
    // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(kick);

    return json({
      success: true,
      message: `Queued for ${enqueue.devices_queued} devices, sending at ${rate} per minute`,
      notification_id: notificationRecord.id,
      queued: enqueue.devices_queued,
      audience: enqueue,
      rate_per_minute: rate,
      eta_seconds: Math.ceil((enqueue.devices_queued / rate) * 60),
    });
  } catch (error: any) {
    console.error('Edge function error:', error);
    return json(
      { error: error.message || 'Internal server error' },
      error.message?.includes('Unauthorized') || error.message?.includes('authorization') ? 401 : 500,
    );
  }
});
