import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendPushNotificationRequest {
  action: 'send_notification';
  title?: string;
  body?: string;
  data?: Record<string, any>;
  target_type?: 'all' | 'individual' | 'segment';
  target_user_ids?: string[];
  target_segment_id?: string;
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

async function checkNotificationPermission(supabaseAuth: any): Promise<boolean> {
  // Check if user is super admin using authenticated client
  const { data: isSuperAdmin, error: superAdminError } = await supabaseAuth
    .rpc('is_super_admin');

  if (superAdminError) {
    console.error('Error checking super admin:', superAdminError);
  }

  if (isSuperAdmin) {
    return true;
  }

  // Check if user has notification permissions using authenticated client
  const { data: hasViewPerm } = await supabaseAuth
    .rpc('has_permission', { permission_name: 'notifications.view' });

  const { data: hasSendPerm } = await supabaseAuth
    .rpc('has_permission', { permission_name: 'notifications.send' });

  const { data: hasCreatePerm } = await supabaseAuth
    .rpc('has_permission', { permission_name: 'notifications.create' });

  return hasViewPerm || hasSendPerm || hasCreatePerm;
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

    // Check if user has notification permissions
    const hasPermission = await checkNotificationPermission(supabaseAuth);

    if (!hasPermission) {
      console.error('User does not have notification permissions');
      throw new Error('Unauthorized: Notification permissions required');
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

      return new Response(
        JSON.stringify({ error: 'notification_id required' }),
        {
          status: 400,
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
        const {
          title,
          body: messageBody,
          data = {},
          target_type = 'all',
          target_user_ids = [],
          target_segment_id,
          personalize = false,
        } = body;

        if (!title || !messageBody) {
          throw new Error('Title and body are required');
        }

        const notificationRecord = await supabase
          .from('push_notifications')
          .insert({
            title,
            body: messageBody,
            data,
            target_type,
            target_user_ids: target_type === 'individual' ? target_user_ids : null,
            target_segment_id: target_type === 'segment' ? target_segment_id : null,
            status: 'sending',
            created_by: user.id,
          })
          .select()
          .single();

        if (notificationRecord.error) {
          throw notificationRecord.error;
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
                .eq('status', 'approved');
              recipientUserIds = kycUsers?.map(k => k.user_id) || [];
            }
          }
        }

        recipientUserIds = [...new Set(recipientUserIds)];

        const { data: tokensData } = await supabase
          .from('user_push_tokens')
          .select('token, user_id, profiles(first_name)')
          .in('user_id', recipientUserIds)
          .eq('is_active', true);

        if (!tokensData || tokensData.length === 0) {
          await supabase
            .from('push_notifications')
            .update({
              status: 'failed',
              error: 'No active push tokens found',
              total_recipients: 0,
              delivered_count: 0,
              failed_count: 0,
              sent_at: new Date().toISOString(),
            })
            .eq('id', notificationRecord.data.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'No active push tokens found for the selected recipients',
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        const validTokensData = tokensData.filter(t => isValidExpoPushToken(t.token));

        const messages: ExpoPushMessage[] = validTokensData.map(tokenData => {
          const profile = tokenData.profiles as any;
          const firstName = profile?.first_name || null;

          return {
            to: tokenData.token,
            sound: 'default' as const,
            title,
            body: personalizeMessage(messageBody, firstName, personalize),
            data,
            priority: 'high' as const,
          };
        });

        try {
          const tickets = await sendPushNotifications(messages);

          let deliveredCount = 0;
          let failedCount = 0;

          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            const tokenData = validTokensData[i];

            const logEntry = {
              push_notification_id: notificationRecord.data.id,
              user_id: tokenData.user_id,
              push_token: tokenData.token,
              status: ticket.status === 'ok' ? 'delivered' : 'failed',
              error: ticket.status === 'error' ? ticket.message : null,
              expo_ticket_id: ticket.id,
            };

            await supabase
              .from('push_notification_logs')
              .insert(logEntry);

            if (ticket.status === 'ok') {
              deliveredCount++;
            } else {
              failedCount++;
            }
          }

          await supabase
            .from('push_notifications')
            .update({
              status: failedCount === tickets.length ? 'failed' : 'sent',
              total_recipients: tickets.length,
              delivered_count: deliveredCount,
              failed_count: failedCount,
              sent_at: new Date().toISOString(),
            })
            .eq('id', notificationRecord.data.id);

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Push notification sent successfully',
              notification_id: notificationRecord.data.id,
              stats: {
                total: tickets.length,
                delivered: deliveredCount,
                failed: failedCount,
              },
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        } catch (exposeError: any) {
          console.error('Error sending push notifications:', exposeError);

          await supabase
            .from('push_notifications')
            .update({
              status: 'failed',
              error: exposeError.message,
              sent_at: new Date().toISOString(),
            })
            .eq('id', notificationRecord.data.id);

          throw exposeError;
        }
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
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
  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: error.message?.includes('Unauthorized') ? 401 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
