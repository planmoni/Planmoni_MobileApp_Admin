import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateCampaignRequest {
  action: 'create_campaign';
  title: string;
  subject: string;
  html_content: string;
  plain_text_content?: string;
  category: string;
  metadata?: Record<string, any>;
}

interface SendCampaignRequest {
  action: 'send_campaign';
  campaign_id: string;
  recipient_filters: {
    segment?: string;
    segment_id?: string;
    kyc_verified?: boolean;
    active_payout_plans?: boolean;
    inactive_days?: number;
  };
}

interface ScheduleCampaignRequest {
  action: 'schedule_campaign';
  campaign_id: string;
  scheduled_at: string;
  recipient_filters: Record<string, any>;
}

type RequestBody = CreateCampaignRequest | SendCampaignRequest | ScheduleCampaignRequest;

async function sendEmailViaResend(
  to: string,
  subject: string,
  htmlContent: string,
  resendApiKey: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Martins Osodi - Planmoni CEO <hello@planmoni.com>',
        to,
        subject,
        html: htmlContent,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', responseData);
      return {
        success: false,
        error: responseData.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      id: responseData.id,
    };
  } catch (error) {
    console.error('Error calling Resend API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // Create client with anon key to validate user token
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

    // Create client with service role key for database operations
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
      const campaignId = url.searchParams.get('campaign_id');

      if (campaignId) {
        const { data: campaign, error } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();

        if (error) throw error;

        const { data: recipients } = await supabase
          .from('campaign_recipients')
          .select('*')
          .eq('campaign_id', campaignId);

        return new Response(
          JSON.stringify({ campaign, recipients }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const { data: campaigns, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ campaigns }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (req.method === 'POST') {
      const body: RequestBody = await req.json();

      if (body.action === 'create_campaign') {
        const { data: campaign, error } = await supabase
          .from('marketing_campaigns')
          .insert([
            {
              title: body.title,
              subject: body.subject,
              html_content: body.html_content,
              plain_text_content: body.plain_text_content || '',
              category: body.category,
              metadata: body.metadata || {},
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, campaign }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      if (body.action === 'send_campaign') {
        if (!resendApiKey) {
          throw new Error('RESEND_API_KEY not configured');
        }

        const { campaign_id, recipient_filters } = body;

        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('id', campaign_id)
          .single();

        if (campaignError) throw campaignError;

        let recipients: any[] = [];

        if (recipient_filters.segment_id && recipient_filters.segment_id !== 'all') {
          const { data: segment } = await supabase
            .from('campaign_segments')
            .select('filters')
            .eq('id', recipient_filters.segment_id)
            .single();

          if (segment) {
            let query = supabase.from('profiles').select('id, email, first_name, last_name');

            if (segment.filters.kyc_status) {
              query = query.eq('kyc_status', segment.filters.kyc_status);
            }

            if (segment.filters.has_payout_plan) {
              const { data: activePlans } = await supabase
                .from('payout_plans')
                .select('user_id')
                .eq('status', 'active');

              const userIds = activePlans?.map((p) => p.user_id) || [];
              if (userIds.length > 0) {
                query = query.in('id', userIds);
              }
            }

            const { data } = await query;
            recipients = data || [];
          }
        } else if (recipient_filters.segment === 'all_active' || recipient_filters.segment_id === 'all') {
          const { data } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name');
          recipients = data || [];
        } else if (recipient_filters.segment === 'kyc_verified') {
          const { data } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name')
            .not('kyc_status', 'is', null);
          recipients = data || [];
        } else if (recipient_filters.active_payout_plans) {
          const { data: activePlans } = await supabase
            .from('payout_plans')
            .select('user_id')
            .eq('status', 'active');

          const userIds = activePlans?.map((p) => p.user_id) || [];
          if (userIds.length > 0) {
            const { data } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .in('id', userIds);
            recipients = data || [];
          }
        }

        const recipientRecords = recipients.map((r) => ({
          campaign_id,
          user_id: r.id,
          email: r.email,
          status: 'pending',
        }));

        if (recipientRecords.length > 0) {
          const { error: insertError } = await supabase
            .from('campaign_recipients')
            .insert(recipientRecords);

          if (insertError) throw insertError;

          await supabase
            .from('marketing_campaigns')
            .update({
              status: 'sending',
              recipient_count: recipientRecords.length,
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign_id);

          let sentCount = 0;
          let deliveredCount = 0;
          let failedCount = 0;

          for (const recipient of recipients) {
            const result = await sendEmailViaResend(
              recipient.email,
              campaign.subject,
              campaign.html_content,
              resendApiKey
            );

            if (result.success) {
              sentCount++;
              deliveredCount++;

              await supabase
                .from('campaign_recipients')
                .update({
                  status: 'delivered',
                  sent_at: new Date().toISOString(),
                  delivered_at: new Date().toISOString(),
                  metadata: { resend_id: result.id },
                })
                .eq('campaign_id', campaign_id)
                .eq('user_id', recipient.id);
            } else {
              failedCount++;

              await supabase
                .from('campaign_recipients')
                .update({
                  status: 'failed',
                  error_message: result.error,
                  sent_at: new Date().toISOString(),
                })
                .eq('campaign_id', campaign_id)
                .eq('user_id', recipient.id);
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          await supabase
            .from('marketing_campaigns')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              delivered_count: deliveredCount,
              failed_count: failedCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign_id);

          return new Response(
            JSON.stringify({
              success: true,
              message: `Campaign sent to ${deliveredCount} recipients (${failedCount} failed)`,
              sent_count: sentCount,
              delivered_count: deliveredCount,
              failed_count: failedCount,
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: 'No recipients found',
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      if (body.action === 'schedule_campaign') {
        const { campaign_id, scheduled_at, recipient_filters } = body;

        const { error } = await supabase
          .from('marketing_campaigns')
          .update({
            status: 'scheduled',
            scheduled_at,
            metadata: { recipient_filters },
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaign_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Campaign scheduled successfully' }),
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
