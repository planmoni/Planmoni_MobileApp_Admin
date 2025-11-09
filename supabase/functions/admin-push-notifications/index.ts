import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendPushNotificationRequest {
  action: 'send_notification';
  title: string;
  body: string;
  data?: Record<string, any>;
  target_type: 'all' | 'individual' | 'segment';
  target_user_ids?: string[];
  target_segment_id?: string;
  schedule_for?: string;
  personalize?: boolean;
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

async function sendPushNotifications(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Expo push notification error:', errorData);
      throw new Error(`Expo API error: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData.data || [];
  } catch (error) {
    console.error('Error calling Expo API:', error);
    throw error;
  }
}

function isValidExpoPushToken(token: string): boolean {
  return (
    token.startsWith('ExponentPushToken[') ||
    token.startsWith('ExpoPushToken[') ||
    /^[a-zA-Z0-9_-]{22}$/.test(token)
  );
}

function personalizeMessage(message: string, firstName: string | null, shouldPersonalize: boolean): string {
  if (!shouldPersonalize) {
    return message;
  }
  const name = firstName && firstName.trim() ? firstName.trim() : 'there';
  return `Hello ${name}, ${message}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      console.error('Profile error:', profileError);
      throw new Error('Unauthorized: Admin access required');
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const notificationId = url.searchParams.get('notification_id');

      if (notificationId) {
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

        return new Response(
          JSON.stringify({ notification, logs }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const { data: notifications, error } = await supabase
        .from('push_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ notifications }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (req.method === 'POST') {
      const body: SendPushNotificationRequest = await req.json();

      if (body.action === 'send_notification') {
        const { title, body: messageBody, data, target_type, target_user_ids, target_segment_id, schedule_for, personalize } = body;

        const { data: notificationRecord, error: createError } = await supabase
          .from('push_notifications')
          .insert([{
            title,
            body: messageBody,
            data: data || {},
            target_type,
            target_user_ids: target_user_ids || [],
            target_segment_id: target_segment_id || null,
            status: schedule_for ? 'scheduled' : 'sending',
            scheduled_for: schedule_for || null,
            created_by: user.id,
          }])
          .select()
          .single();

        if (createError) throw createError;

        if (schedule_for) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Notification scheduled successfully',
              notification_id: notificationRecord.id,
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        let recipientUserIds: string[] = [];

        if (target_type === 'all') {
          const { data: tokens } = await supabase
            .from('user_push_tokens')
            .select('user_id')
            .eq('is_active', true);
          recipientUserIds = tokens?.map(t => t.user_id) || [];
        } else if (target_type === 'individual' && target_user_ids) {
          recipientUserIds = target_user_ids;
        } else if (target_type === 'segment' && target_segment_id) {
          const { data: segment } = await supabase
            .from('push_notification_segments')
            .select('filter_criteria')
            .eq('id', target_segment_id)
            .single();

          if (segment) {
            const filterType = segment.filter_criteria.type;

            if (filterType === 'all') {
              const { data: allUsers } = await supabase
                .from('profiles')
                .select('id');
              recipientUserIds = allUsers?.map(u => u.id) || [];
            } else if (filterType === 'has_active_plans') {
              const { data: activePlans } = await supabase
                .from('payout_plans')
                .select('user_id')
                .eq('status', 'active');
              recipientUserIds = [...new Set(activePlans?.map(p => p.user_id) || [])];
            } else if (filterType === 'kyc_approved') {
              const { data: kycUsers } = await supabase
                .from('kyc_data')
                .select('user_id')
                .eq('approved', true);
              recipientUserIds = kycUsers?.map(k => k.user_id) || [];
            } else if (filterType === 'joined_recently') {
              const days = segment.filter_criteria.days || 30;
              const { data: recentUsers } = await supabase
                .from('profiles')
                .select('id')
                .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
              recipientUserIds = recentUsers?.map(u => u.id) || [];
            }
          }
        }

        const { data: pushTokensData } = await supabase
          .from('user_push_tokens')
          .select('user_id, expo_push_token')
          .in('user_id', recipientUserIds)
          .eq('is_active', true);

        if (!pushTokensData || pushTokensData.length === 0) {
          await supabase
            .from('push_notifications')
            .update({
              status: 'failed',
              total_recipients: 0,
              failed_count: 0,
            })
            .eq('id', notificationRecord.id);

          return new Response(
            JSON.stringify({
              success: false,
              message: 'No active push tokens found for recipients',
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        const userIds = pushTokensData.map(t => t.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p.first_name]) || []);

        const pushTokens = pushTokensData.map(item => ({
          user_id: item.user_id,
          expo_push_token: item.expo_push_token,
          first_name: profilesMap.get(item.user_id) || null,
        }));

        const validTokens = pushTokens.filter(t => isValidExpoPushToken(t.expo_push_token));

        await supabase
          .from('push_notifications')
          .update({
            total_recipients: validTokens.length,
          })
          .eq('id', notificationRecord.id);

        const messages: ExpoPushMessage[] = validTokens.map(token => ({
          to: token.expo_push_token,
          sound: 'default',
          title,
          body: personalizeMessage(messageBody, token.first_name, personalize || false),
          data: data || {},
          priority: 'high',
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
              const tokenInfo = batchTokens[j];

              const logStatus = ticket.status === 'ok' ? 'sent' : 'failed';
              const errorMessage = ticket.status === 'error' ? ticket.message || 'Unknown error' : null;

              if (ticket.status === 'ok') {
                deliveredCount++;
              } else {
                failedCount++;
              }

              await supabase
                .from('push_notification_logs')
                .insert({
                  push_notification_id: notificationRecord.id,
                  user_id: tokenInfo.user_id,
                  push_token: tokenInfo.expo_push_token,
                  status: logStatus,
                  error_message: errorMessage,
                  expo_receipt_id: ticket.id || null,
                  sent_at: new Date().toISOString(),
                });

              if (ticket.status === 'ok') {
                await supabase
                  .from('user_push_tokens')
                  .update({ last_used: new Date().toISOString() })
                  .eq('expo_push_token', tokenInfo.expo_push_token);
              }
            }
          } catch (error) {
            console.error('Batch send error:', error);
            failedCount += batch.length;

            for (const tokenInfo of batchTokens) {
              await supabase
                .from('push_notification_logs')
                .insert({
                  push_notification_id: notificationRecord.id,
                  user_id: tokenInfo.user_id,
                  push_token: tokenInfo.expo_push_token,
                  status: 'failed',
                  error_message: error instanceof Error ? error.message : 'Batch send failed',
                  sent_at: new Date().toISOString(),
                });
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await supabase
          .from('push_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            delivered_count: deliveredCount,
            failed_count: failedCount,
          })
          .eq('id', notificationRecord.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Notification sent to ${deliveredCount} recipients (${failedCount} failed)`,
            notification_id: notificationRecord.id,
            delivered_count: deliveredCount,
            failed_count: failedCount,
            total_recipients: validTokens.length,
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      throw new Error('Invalid action');
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});