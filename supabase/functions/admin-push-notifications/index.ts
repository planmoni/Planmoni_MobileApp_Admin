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
    console.log(`Sending ${messages.length} messages to Expo API`);
    console.log('Sample message:', JSON.stringify(messages[0], null, 2));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const responseData = await response.json();
    console.log('Expo API response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('Expo push notification error:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      });
      throw new Error(`Expo API error ${response.status}: ${JSON.stringify(responseData)}`);
    }

    return responseData.data || [];
  } catch (error) {
    console.error('Error calling Expo API:', error);
    throw error;
  }
}

function isValidExpoPushToken(token: string): boolean {
  // Valid Expo push token formats:
  // 1. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  // 2. ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  // 3. Legacy format: 22 character alphanumeric string

  if (!token || typeof token !== 'string') {
    return false;
  }

  // Check for ExponentPushToken format
  if (token.startsWith('ExponentPushToken[') && token.endsWith(']')) {
    const inner = token.slice(18, -1);
    return inner.length > 0 && /^[a-zA-Z0-9_-]+$/.test(inner);
  }

  // Check for ExpoPushToken format (newer)
  if (token.startsWith('ExpoPushToken[') && token.endsWith(']')) {
    const inner = token.slice(14, -1);
    return inner.length > 0 && /^[a-zA-Z0-9_-]+$/.test(inner);
  }

  // Legacy format: exactly 22 characters, alphanumeric with dashes/underscores
  if (/^[a-zA-Z0-9_-]{22}$/.test(token)) {
    return true;
  }

  // Reject everything else (including 64-char hex strings)
  return false;
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
          const { data: tokens, error: tokensError } = await supabase
            .from('user_push_tokens')
            .select('user_id')
            .eq('is_active', true);

          if (tokensError) {
            console.error('Error fetching tokens for all users:', tokensError);
          }

          recipientUserIds = tokens?.map(t => t.user_id) || [];
          console.log(`Target type: all, found ${recipientUserIds.length} users with push tokens`);
        } else if (target_type === 'individual' && target_user_ids) {
          recipientUserIds = target_user_ids;
          console.log(`Target type: individual, targeting ${recipientUserIds.length} specific users`);
        } else if (target_type === 'segment' && target_segment_id) {
          const { data: segment, error: segmentError } = await supabase
            .from('push_notification_segments')
            .select('filter_criteria')
            .eq('id', target_segment_id)
            .single();

          if (segmentError) {
            console.error('Error fetching segment:', segmentError);
          }

          if (segment) {
            const filterType = segment.filter_criteria.type;
            console.log(`Target type: segment (${filterType})`);

            if (filterType === 'all') {
              const { data: allUsers, error: usersError } = await supabase
                .from('profiles')
                .select('id');

              if (usersError) {
                console.error('Error fetching all users from profiles:', usersError);
              }

              recipientUserIds = allUsers?.map(u => u.id) || [];
              console.log(`Segment 'all' found ${recipientUserIds.length} users`);
            } else if (filterType === 'has_active_plans') {
              const { data: activePlans, error: plansError } = await supabase
                .from('payout_plans')
                .select('user_id')
                .eq('status', 'active');

              if (plansError) {
                console.error('Error fetching active plans:', plansError);
              }

              recipientUserIds = [...new Set(activePlans?.map(p => p.user_id) || [])];
              console.log(`Segment 'has_active_plans' found ${recipientUserIds.length} users`);
            } else if (filterType === 'kyc_approved') {
              const { data: kycUsers, error: kycError } = await supabase
                .from('kyc_data')
                .select('user_id')
                .eq('status', 'approved');

              if (kycError) {
                console.error('Error fetching KYC approved users:', kycError);
              }

              recipientUserIds = kycUsers?.map(k => k.user_id) || [];
              console.log(`Segment 'kyc_approved' found ${recipientUserIds.length} users`);
            }
          }
        }

        recipientUserIds = [...new Set(recipientUserIds)];
        console.log(`Total unique recipient user IDs: ${recipientUserIds.length}`);

        const { data: tokensData, error: tokensDataError } = await supabase
          .from('user_push_tokens')
          .select('expo_push_token, user_id, profiles(first_name)')
          .in('user_id', recipientUserIds)
          .eq('is_active', true);

        if (tokensDataError) {
          console.error('Error fetching token data:', tokensDataError);
        }

        console.log(`Found ${tokensData?.length || 0} active push tokens for recipients`);

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

        // Filter out invalid tokens and mark them as inactive
        const validTokensData: any[] = [];
        const invalidTokensData: any[] = [];

        for (const tokenData of tokensData) {
          if (isValidExpoPushToken(tokenData.expo_push_token)) {
            validTokensData.push(tokenData);
          } else {
            invalidTokensData.push(tokenData);
            console.warn(`Invalid token format detected: ${tokenData.expo_push_token.substring(0, 20)}...`);
          }
        }

        // Deactivate invalid tokens
        if (invalidTokensData.length > 0) {
          const invalidTokenIds = invalidTokensData.map(t => t.expo_push_token);
          await supabase
            .from('user_push_tokens')
            .update({ is_active: false })
            .in('expo_push_token', invalidTokenIds);

          console.log(`Deactivated ${invalidTokensData.length} invalid tokens`);
        }

        if (validTokensData.length === 0) {
          await supabase
            .from('push_notifications')
            .update({
              status: 'failed',
              error: `No valid push tokens found. ${invalidTokensData.length} invalid tokens were deactivated.`,
              total_recipients: 0,
              delivered_count: 0,
              failed_count: 0,
              sent_at: new Date().toISOString(),
            })
            .eq('id', notificationRecord.data.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: `No valid push tokens found. ${invalidTokensData.length} invalid tokens were deactivated.`,
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

        console.log(`Sending to ${validTokensData.length} valid tokens (filtered out ${invalidTokensData.length} invalid tokens)`);

        const messages: ExpoPushMessage[] = validTokensData.map(tokenData => {
          const profile = tokenData.profiles as any;
          const firstName = profile?.first_name || null;

          return {
            to: tokenData.expo_push_token,
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
              push_token: tokenData.expo_push_token,
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

              // Deactivate tokens that are permanently invalid
              if (ticket.message) {
                const errorMsg = ticket.message.toLowerCase();
                const shouldDeactivate =
                  errorMsg.includes('devicenotregistered') ||
                  errorMsg.includes('invalid credentials') ||
                  errorMsg.includes('missingscopeorpermission') ||
                  errorMsg.includes('404');

                if (shouldDeactivate) {
                  console.log(`Deactivating invalid token for user ${tokenData.user_id}: ${ticket.message}`);
                  await supabase
                    .from('user_push_tokens')
                    .update({ is_active: false })
                    .eq('expo_push_token', tokenData.expo_push_token);
                }
              }
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
