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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
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
        const { campaign_id, recipient_filters } = body;

        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('id', campaign_id)
          .single();

        if (campaignError) throw campaignError;

        let query = supabase.from('profiles').select('id, email, first_name, last_name');

        if (recipient_filters.segment === 'kyc_verified') {
          query = query.not('kyc_status', 'is', null);
        }

        if (recipient_filters.active_payout_plans) {
          const { data: activePlans } = await supabase
            .from('payout_plans')
            .select('user_id')
            .eq('status', 'active');

          const userIds = activePlans?.map((p) => p.user_id) || [];
          if (userIds.length > 0) {
            query = query.in('id', userIds);
          }
        }

        const { data: recipients, error: recipientsError } = await query;

        if (recipientsError) throw recipientsError;

        const recipientRecords = recipients?.map((r) => ({
          campaign_id,
          user_id: r.id,
          email: r.email,
          status: 'pending',
        })) || [];

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
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Campaign queued for ${recipientRecords.length} recipients`,
            recipient_count: recipientRecords.length,
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