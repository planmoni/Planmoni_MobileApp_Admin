import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendPushNotificationRequest {
  action: 'send_notification' | 'send_reengagement';
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
}

interface ExpoPushMessage {
  to: string;
  sound?: 'default';
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'normal' | 'high';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

const REENGAGEMENT_TEMPLATES: Record<string, any> = {
  zero_balance_reminder: {
    title: '💰 Your Wallet Needs Attention',
    body: 'Your wallet balance is empty. Add funds to start saving again and reach your goals!',
    data: { type: 'zero_balance_reminder', screen: 'Wallet', action: 'deposit' },
    sound: 'default',
    priority: 'high',
  },
  vault_unfunded_reminder: {
    title: '🏦 Your Vault is Waiting',
    body: 'Fund your vault to activate automatic savings and watch your money grow!',
    data: { type: 'vault_unfunded_reminder', screen: 'Vaults', action: 'fund_vault' },
    sound: 'default',
    priority: 'high',
  },
  deposit_no_plan: {
    title: '📋 Complete Your Setup',
    body: "You've deposited funds but haven't created a savings plan yet. Create one now to start earning!",
    data: { type: 'deposit_no_plan', screen: 'CreatePlan', action: 'create_plan' },
    sound: 'default',
    priority: 'high',
  },
  no_plan_yet: {
    title: '👋 Welcome to PlanMoni!',
    body: 'Complete your setup by creating your first savings plan and start your journey to financial freedom.',
    data: { type: 'no_plan_yet', screen: 'CreatePlan', action: 'create_plan' },
    sound: 'default',
    priority: 'normal',
  },
  re_engagement: {
    title: '🌟 We Miss You!',
    body: "It's been a while since your last visit. Come back and continue your savings journey with PlanMoni!",
    data: { type: 're_engagement', screen: 'Dashboard', action: 'open_app' },
    sound: 'default',
    priority: 'normal',
  },
};

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
      cleaned[key] = value.map(item =>
        typeof item === 'string' ? truncateString(item, 100) : item
      );
    } else if (value && typeof value === 'object') {
      cleaned[key] = cleanDataObject(value);
    }
  }
  return cleaned;
}

async function sendPushNotifications(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  try {
    console.log(`Sending ${messages.length} messages to Expo API`);

    const validatedMessages = messages.map(msg => {
      const validated: ExpoPushMessage = {
        to: msg.to,
        sound: msg.sound || 'default',
        title: truncateString(msg.title, 100),
        body: truncateString(msg.body, 200),
        priority: msg.priority || 'high',
      };

      if (msg.data && typeof msg.data === 'object' && Object.keys(msg.data).length > 0) {
        validated.data = cleanDataObject(msg.data);
      }

      return validated;
    });

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedMessages),
    });

    const responseData = await response.json();
    console.log('Expo API response status:', response.status);

    if (!response.ok) {
      console.error('Expo push notification error:', JSON.stringify(responseData, null, 2));
      throw new Error(`Expo API error ${response.status}: ${JSON.stringify(responseData)}`);
    }

    return responseData.data || [];
  } catch (error) {
    console.error('Error calling Expo API:', error);
    throw error;
  }
}

function isValidExpoPushToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[') || /^[a-zA-Z0-9_-]{22}$/.test(token);
}

function personalizeMessage(message: string, firstName: string | null, shouldPersonalize: boolean): string {
  if (!shouldPersonalize) {
    return truncateString(message, 200);
  }
  const name = firstName && firstName.trim() ? firstName.trim() : 'there';
  const prefix = `Hello ${name}, `;
  const maxMessageLength = 170;
  const truncatedMessage = truncateString(message, maxMessageLength);
  const finalMessage = prefix + truncatedMessage;
  return truncateString(finalMessage, 200);
}

async function checkNotificationPermission(supabaseAuth: any): Promise<boolean> {
  const { data: isSuperAdmin } = await supabaseAuth.rpc('is_super_admin');
  if (isSuperAdmin) return true;

  const { data: hasViewPerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'notifications.view' });
  const { data: hasSendPerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'notifications.send' });
  const { data: hasCreatePerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'notifications.create' });

  return hasViewPerm || hasSendPerm || hasCreatePerm;
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

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const hasPermission = await checkNotificationPermission(supabaseAuth);
    if (!hasPermission) {
      throw new Error('Unauthorized: Notification permissions required');
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const notificationId = url.searchParams.get('notification_id');
      if (!notificationId) {
        return new Response(JSON.stringify({ error: 'notification_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: notification, error } = await supabase
        .from('push_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (error) throw error;

      const { data: logs } = await supabase
        .from('push_notification_logs')
        .select('*')
        .eq('push_notification_id', notificationId)
        .order('created_at', { ascending: false });

      return new Response(JSON.stringify({ notification, logs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body: SendPushNotificationRequest = await req.json();

      if (body.action === 'send_reengagement') {
        const { category } = body;

        if (!category || !REENGAGEMENT_TEMPLATES[category]) {
          return new Response(JSON.stringify({ error: 'Invalid re-engagement category' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const template = REENGAGEMENT_TEMPLATES[category];

        let rpcFunction = '';
        switch (category) {
          case 'zero_balance_reminder':
            rpcFunction = 'get_zero_balance_users';
            break;
          case 'vault_unfunded_reminder':
            rpcFunction = 'get_unfunded_vault_users';
            break;
          case 'deposit_no_plan':
            rpcFunction = 'get_deposit_no_plan_users';
            break;
          case 'no_plan_yet':
            rpcFunction = 'get_no_plan_users';
            break;
          case 're_engagement':
            rpcFunction = 'get_inactive_users';
            break;
          default:
            throw new Error('Invalid category');
        }

        const { data: eligibleUsers, error: rpcError } = await supabase.rpc(rpcFunction);

        if (rpcError) throw rpcError;

        if (!eligibleUsers || eligibleUsers.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No eligible users found for this re-engagement category',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const userIds = eligibleUsers.map((u: any) => u.user_id);

        const { data: tokens } = await supabase
          .from('user_push_tokens')
          .select('expo_push_token, user_id')
          .in('user_id', userIds)
          .eq('is_active', true);

        if (!tokens || tokens.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No active push tokens found for eligible users',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: notificationRecord, error: notifError } = await supabase
          .from('push_notifications')
          .insert({
            title: template.title,
            body: template.body,
            data: template.data,
            target_type: 'individual',
            target_user_ids: userIds,
            status: 'sending',
            created_by: user.id,
            notification_type: 'reengagement',
            notification_category: category,
          })
          .select()
          .single();

        if (notifError) throw notifError;

        const validTokens = tokens.filter(t => isValidExpoPushToken(t.expo_push_token));

        const messages: ExpoPushMessage[] = validTokens.map(token => ({
          to: token.expo_push_token,
          sound: template.sound,
          title: template.title,
          body: template.body,
          data: template.data,
          priority: template.priority,
        }));

        const BATCH_SIZE = 100;
        let deliveredCount = 0;
        let failedCount = 0;

        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
          const batch = messages.slice(i, i + BATCH_SIZE);
          const batchTokens = validTokens.slice(i, i + BATCH_SIZE);

          try {
            const tickets = await sendPushNotifications(batch);

            for (let j = 0; j < tickets.length; j++) {
              const ticket = tickets[j];
              const token = batchTokens[j];

              await supabase.from('push_notification_logs').insert({
                push_notification_id: notificationRecord.id,
                user_id: token.user_id,
                push_token: token.expo_push_token,
                status: ticket.status === 'ok' ? 'delivered' : 'failed',
                error_message: ticket.status === 'error' ? ticket.message : null,
                expo_receipt_id: ticket.id || null,
                sent_at: new Date().toISOString(),
              });

              if (ticket.status === 'ok') {
                deliveredCount++;
                await supabase
                  .from('profiles')
                  .update({
                    last_reengagement_sent: {
                      [category]: new Date().toISOString(),
                    },
                  })
                  .eq('id', token.user_id);
              } else {
                failedCount++;
                if (ticket.message?.toLowerCase().includes('devicenotregistered') ||
                    ticket.message?.toLowerCase().includes('invalid')) {
                  await supabase
                    .from('user_push_tokens')
                    .update({ is_active: false })
                    .eq('expo_push_token', token.expo_push_token);
                }
              }
            }
          } catch (error: any) {
            console.error(`Error sending batch:`, error);
            failedCount += batch.length;
          }
        }

        await supabase
          .from('push_notifications')
          .update({
            status: failedCount === validTokens.length ? 'failed' : 'sent',
            total_recipients: validTokens.length,
            delivered_count: deliveredCount,
            failed_count: failedCount,
            sent_at: new Date().toISOString(),
          })
          .eq('id', notificationRecord.id);

        return new Response(JSON.stringify({
          success: true,
          message: `Re-engagement alert sent to ${deliveredCount} users`,
          notification_id: notificationRecord.id,
          stats: {
            total: validTokens.length,
            delivered: deliveredCount,
            failed: failedCount,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (body.action !== 'send_notification') {
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const {
        title,
        body: messageBody,
        data = {},
        target_type = 'all',
        target_user_ids = [],
        target_segment_id,
        personalize = false,
        notification_type = 'manual',
        notification_category,
      } = body;

      if (!title || !messageBody) {
        throw new Error('Title and body are required');
      }

      const { data: notificationRecord, error: notifError } = await supabase
        .from('push_notifications')
        .insert({
          title: truncateString(title, 100),
          body: truncateString(messageBody, 200),
          data: cleanDataObject(data),
          target_type,
          target_user_ids: target_type === 'individual' ? target_user_ids : null,
          target_segment_id: target_type === 'segment' ? target_segment_id : null,
          status: 'sending',
          created_by: user.id,
          notification_type,
          notification_category: notification_category || null,
        })
        .select()
        .single();

      if (notifError) throw notifError;

      console.log('=== PUSH NOTIFICATION START ===');
      console.log('Target type:', target_type);
      console.log('Title:', truncateString(title, 50));
      console.log('Body:', truncateString(messageBody, 50));

      let tokens: Array<{ expo_push_token: string; user_id: string; first_name?: string | null }> = [];

      if (target_type === 'all') {
        const { data: rpcTokens, error: rpcError } = await supabase.rpc('get_all_active_push_tokens');

        if (rpcError) {
          console.error('RPC error, trying direct query:', rpcError);
          const { data: directTokens, error: directError } = await supabase
            .from('user_push_tokens')
            .select('expo_push_token, user_id')
            .eq('is_active', true);

          if (directError) throw directError;
          tokens = (directTokens || []).map(t => ({ ...t, first_name: null }));
        } else {
          tokens = (rpcTokens || []).map((t: any) => ({
            expo_push_token: t.expo_push_token,
            user_id: t.user_id,
            first_name: t.first_name || null
          }));
        }
      } else if (target_type === 'individual' && target_user_ids.length > 0) {
        const { data: directTokens, error: directError } = await supabase
          .from('user_push_tokens')
          .select('expo_push_token, user_id')
          .in('user_id', target_user_ids)
          .eq('is_active', true);

        if (directError) throw directError;

        const userIds = [...new Set((directTokens || []).map(t => t.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name')
          .in('id', userIds);

        const profilesMap = new Map((profiles || []).map(p => [p.id, p.first_name]));
        tokens = (directTokens || []).map(t => ({
          ...t,
          first_name: profilesMap.get(t.user_id) || null
        }));
      } else if (target_type === 'segment' && target_segment_id) {
        const { data: segment } = await supabase
          .from('push_notification_segments')
          .select('filter_criteria')
          .eq('id', target_segment_id)
          .single();

        if (!segment) throw new Error('Segment not found');

        const filterType = segment.filter_criteria?.type;

        if (filterType === 'all') {
          const { data: rpcTokens } = await supabase.rpc('get_all_active_push_tokens');
          tokens = (rpcTokens || []).map((t: any) => ({
            expo_push_token: t.expo_push_token,
            user_id: t.user_id,
            first_name: t.first_name || null
          }));
        } else if (filterType === 'has_active_plans') {
          const { data: plans } = await supabase
            .from('payout_plans')
            .select('user_id')
            .eq('status', 'active');

          const planUserIds = [...new Set((plans || []).map(p => p.user_id))];
          if (planUserIds.length > 0) {
            const { data: directTokens } = await supabase
              .from('user_push_tokens')
              .select('expo_push_token, user_id')
              .in('user_id', planUserIds)
              .eq('is_active', true);

            const userIds = [...new Set((directTokens || []).map(t => t.user_id))];
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, first_name')
              .in('id', userIds);

            const profilesMap = new Map((profiles || []).map(p => [p.id, p.first_name]));
            tokens = (directTokens || []).map(t => ({
              ...t,
              first_name: profilesMap.get(t.user_id) || null
            }));
          }
        } else if (filterType === 'kyc_approved') {
          const { data: kycUsers } = await supabase
            .from('kyc_data')
            .select('user_id')
            .eq('approved', true);

          const kycUserIds = [...new Set((kycUsers || []).map(k => k.user_id))];
          if (kycUserIds.length > 0) {
            const { data: directTokens } = await supabase
              .from('user_push_tokens')
              .select('expo_push_token, user_id')
              .in('user_id', kycUserIds)
              .eq('is_active', true);

            const userIds = [...new Set((directTokens || []).map(t => t.user_id))];
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, first_name')
              .in('id', userIds);

            const profilesMap = new Map((profiles || []).map(p => [p.id, p.first_name]));
            tokens = (directTokens || []).map(t => ({
              ...t,
              first_name: profilesMap.get(t.user_id) || null
            }));
          }
        }
      }

      console.log(`Found ${tokens.length} tokens`);

      if (tokens.length === 0) {
        await supabase
          .from('push_notifications')
          .update({
            status: 'failed',
            error: 'No active push tokens found',
            total_recipients: 0,
            sent_at: new Date().toISOString(),
          })
          .eq('id', notificationRecord.id);

        return new Response(JSON.stringify({
          success: false,
          error: 'No active push tokens found for the selected recipients',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validTokens = tokens.filter(t => isValidExpoPushToken(t.expo_push_token));
      console.log(`Valid tokens: ${validTokens.length} / ${tokens.length}`);

      if (validTokens.length === 0) {
        await supabase
          .from('push_notifications')
          .update({
            status: 'failed',
            error: 'No valid push tokens found',
            total_recipients: 0,
            sent_at: new Date().toISOString(),
          })
          .eq('id', notificationRecord.id);

        return new Response(JSON.stringify({
          success: false,
          error: 'No valid push tokens found',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messages: ExpoPushMessage[] = validTokens.map(token => {
        const finalTitle = truncateString(title, 100);
        const finalBody = personalizeMessage(messageBody, token.first_name, personalize);
        const messageData: ExpoPushMessage = {
          to: token.expo_push_token,
          sound: 'default',
          title: finalTitle,
          body: finalBody,
          priority: 'high',
        };

        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          const cleanedData = cleanDataObject(data);
          if (Object.keys(cleanedData).length > 0) {
            messageData.data = cleanedData;
          }
        }

        return messageData;
      });

      console.log(`Prepared ${messages.length} messages`);

      const BATCH_SIZE = 100;
      let deliveredCount = 0;
      let failedCount = 0;

      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        const batchTokens = validTokens.slice(i, i + BATCH_SIZE);

        try {
          const tickets = await sendPushNotifications(batch);

          for (let j = 0; j < tickets.length; j++) {
            const ticket = tickets[j];
            const token = batchTokens[j];

            await supabase.from('push_notification_logs').insert({
              push_notification_id: notificationRecord.id,
              user_id: token.user_id,
              push_token: token.expo_push_token,
              status: ticket.status === 'ok' ? 'delivered' : 'failed',
              error_message: ticket.status === 'error' ? ticket.message : null,
              expo_receipt_id: ticket.id || null,
              sent_at: new Date().toISOString(),
            });

            if (ticket.status === 'ok') {
              deliveredCount++;
            } else {
              failedCount++;
              if (ticket.message?.toLowerCase().includes('devicenotregistered') ||
                  ticket.message?.toLowerCase().includes('invalid')) {
                await supabase
                  .from('user_push_tokens')
                  .update({ is_active: false })
                  .eq('expo_push_token', token.expo_push_token);
              }
            }
          }
        } catch (error: any) {
          console.error(`Error sending batch ${i / BATCH_SIZE + 1}:`, error);
          failedCount += batch.length;
        }
      }

      await supabase
        .from('push_notifications')
        .update({
          status: failedCount === validTokens.length ? 'failed' : 'sent',
          total_recipients: validTokens.length,
          delivered_count: deliveredCount,
          failed_count: failedCount,
          sent_at: new Date().toISOString(),
        })
        .eq('id', notificationRecord.id);

      console.log(`=== COMPLETE: ${deliveredCount} delivered, ${failedCount} failed ===`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Push notification sent successfully',
        notification_id: notificationRecord.id,
        stats: {
          total: validTokens.length,
          delivered: deliveredCount,
          failed: failedCount,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: error.message?.includes('Unauthorized') ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
