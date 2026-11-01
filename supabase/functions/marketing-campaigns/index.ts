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
  from_email_id?: string | null;
  metadata?: Record<string, any>;
}

interface UpdateCampaignRequest {
  action: 'update_campaign';
  campaign_id: string;
  title: string;
  subject: string;
  html_content: string;
  plain_text_content?: string;
  category: string;
  from_email_id?: string | null;
  metadata?: Record<string, any>;
}

interface SendCampaignRequest {
  action: 'send_campaign';
  campaign_id: string;
  batch_size?: number; // emails per batch, 1-100
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

interface RetryCampaignRequest {
  action: 'retry_campaign';
  campaign_id: string;
  recipient_ids?: string[]; // Optional: retry specific recipients, or all failed/pending if not provided
}

interface DeleteCampaignsRequest {
  action: 'delete_campaigns';
  campaign_ids: string[];
}

type RequestBody = CreateCampaignRequest | UpdateCampaignRequest | SendCampaignRequest | ScheduleCampaignRequest | RetryCampaignRequest | DeleteCampaignsRequest;

async function sendEmailViaResend(
  to: string,
  subject: string,
  htmlContent: string,
  resendApiKey: string,
  fromEmail?: string
): Promise<{ success: boolean; id?: string; error?: string; retryable?: boolean }> {
  try {
    // Default to the hardcoded email if fromEmail is not provided (backward compatibility)
    const fromAddress = fromEmail || 'Martins Osodi - Planmoni CEO <hello@planmoni.com>';
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject,
        html: htmlContent,
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Resend API error:', responseData);
      return {
        success: false,
        error: responseData.message || 'Failed to send email',
        // rate limit or Resend-side trouble: worth another try. 4xx otherwise (bad address, etc.) is final.
        retryable: response.status === 429 || response.status >= 500,
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
      retryable: true, // network failure
    };
  }
}

// One Resend request for up to 100 emails. Each email still goes to its own single recipient.
// Resend accepts or rejects the whole batch (for example one malformed address rejects all of it).
async function sendBatchViaResend(
  recipients: { id: string; email: string }[],
  subject: string,
  htmlContent: string,
  resendApiKey: string,
  fromAddress: string
): Promise<{ success: boolean; ids?: (string | undefined)[]; error?: string; retryable?: boolean; status?: number }> {
  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        recipients.map((r) => ({ from: fromAddress, to: r.email, subject, html: htmlContent }))
      ),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Resend batch error:', response.status, responseData);
      return {
        success: false,
        error: responseData.message || `Resend rejected the batch (${response.status})`,
        retryable: response.status === 429 || response.status >= 500,
        status: response.status,
      };
    }

    const data: { id?: string }[] = Array.isArray(responseData.data) ? responseData.data : [];
    return { success: true, ids: recipients.map((_, i) => data[i]?.id) };
  } catch (error) {
    console.error('Error calling Resend batch API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true, // network failure
    };
  }
}

// ---------------------------------------------------------------------------
// Queue worker
//
// Campaign recipients live in `campaign_recipients` (queued in SQL by marketing_enqueue_recipients). This worker sends
// them in BATCHES (campaign.batch_size, 50 by default, one Resend batch request each) with a pause between batches
// (campaign.send_delay_seconds, 10 s by default). The pause is enforced by the database
// (marketing_claim_next_batch hands out a batch only when next_send_at has passed), so several workers running
// at once, which happens on purpose around restarts, can never send faster than that.
// A worker runs for a bounded time and exits; the per-minute cron (marketing_queue_tick) and the Send button start the next.
// ---------------------------------------------------------------------------
const WORKER_BUDGET_MS = 120_000;
const MIN_TIME_LEFT_TO_SEND_MS = 20_000;
const RETRY_DELAYS_MS = [3_000, 8_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveFromAddress(supabase: any, fromEmailId: string | null): Promise<string> {
  let fromAddress = 'Martins Osodi - Planmoni CEO <hello@planmoni.com>'; // default fallback
  if (fromEmailId) {
    const { data: senderEmail } = await supabase
      .from('sender_email_addresses')
      .select('email, display_name, is_active')
      .eq('id', fromEmailId)
      .maybeSingle();
    if (senderEmail && senderEmail.is_active) {
      return `${senderEmail.display_name} <${senderEmail.email}>`;
    }
  } else {
    const { data: defaultEmail } = await supabase
      .from('sender_email_addresses')
      .select('email, display_name')
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (defaultEmail) {
      fromAddress = `${defaultEmail.display_name} <${defaultEmail.email}>`;
    }
  }
  return fromAddress;
}

async function runQueueWorker(supabase: any, resendApiKey: string): Promise<void> {
  const startedAt = Date.now();
  const timeLeft = () => WORKER_BUDGET_MS - (Date.now() - startedAt);
  const campaignCache = new Map<string, { subject: string; html: string; from: string }>();
  let consecutiveErrors = 0;
  let sentThisRun = 0;

  console.log('Queue worker started');

  while (timeLeft() > MIN_TIME_LEFT_TO_SEND_MS) {
    const { data: next, error: nextError } = await supabase
      .from('marketing_campaigns')
      .select('id, subject, html_content, from_email_id')
      .eq('status', 'sending')
      .eq('queue_enabled', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) {
      console.error('Queue worker: cannot read campaigns:', nextError);
      if (++consecutiveErrors >= 5) break;
      await sleep(2000);
      continue;
    }
    if (!next) break; // nothing to send

    let content = campaignCache.get(next.id);
    if (!content) {
      content = {
        subject: next.subject,
        html: next.html_content,
        from: await resolveFromAddress(supabase, next.from_email_id),
      };
      campaignCache.set(next.id, content);
    }

    const { data: claim, error: claimError } = await supabase.rpc('marketing_claim_next_batch', {
      p_campaign_id: next.id,
    });
    if (claimError || !claim) {
      console.error('Queue worker: claim failed:', claimError);
      if (++consecutiveErrors >= 5) break;
      await sleep(2000);
      continue;
    }
    consecutiveErrors = 0;

    if (claim.state === 'wait') {
      const waitMs = Math.max(100, Number(claim.wait_ms) || 1000) + 50;
      if (timeLeft() - waitMs < MIN_TIME_LEFT_TO_SEND_MS) break; // the next worker picks it up
      await sleep(waitMs);
      continue;
    }
    if (claim.state === 'inactive') {
      await sleep(1000);
      continue;
    }
    if (claim.state === 'done') {
      campaignCache.delete(next.id);
      console.log(`Campaign ${next.id} finished`);
      continue;
    }
    if (claim.state !== 'send' || !Array.isArray(claim.recipients) || claim.recipients.length === 0) continue;

    const recipients = claim.recipients as { id: string; email: string }[];
    type Outcome = { id: string; ok: boolean | null; resend_id?: string; error?: string };
    const outcomes: Outcome[] = [];

    let batch = await sendBatchViaResend(recipients, content.subject, content.html, resendApiKey, content.from);
    for (const delay of RETRY_DELAYS_MS) {
      if (batch.success || !batch.retryable) break;
      console.log(`Retrying batch in ${delay} ms: ${batch.error}`);
      await sleep(delay);
      batch = await sendBatchViaResend(recipients, content.subject, content.html, resendApiKey, content.from);
    }

    if (batch.success) {
      recipients.forEach((r, i) => outcomes.push({ id: r.id, ok: true, resend_id: batch.ids?.[i] }));
    } else if (batch.retryable || batch.status === 401 || batch.status === 403) {
      // Resend is down, rate limiting us, or rejects our key: every email would fail the same way.
      recipients.forEach((r) => outcomes.push({ id: r.id, ok: false, error: batch.error }));
    } else {
      // Resend refused the batch because of the content of (at least) one email, usually a bad address.
      // Send them one by one so only the offending address fails. Resend allows about 2 requests a second.
      console.log(`Batch rejected (${batch.error}); sending its ${recipients.length} emails one by one`);
      for (const r of recipients) {
        if (timeLeft() < 5_000) {
          outcomes.push({ id: r.id, ok: null }); // out of time: back in the queue for the next worker
          continue;
        }
        let single = await sendEmailViaResend(r.email, content.subject, content.html, resendApiKey, content.from);
        for (const delay of RETRY_DELAYS_MS) {
          if (single.success || !single.retryable || timeLeft() < 5_000) break;
          await sleep(delay);
          single = await sendEmailViaResend(r.email, content.subject, content.html, resendApiKey, content.from);
        }
        outcomes.push(
          single.success
            ? { id: r.id, ok: true, resend_id: single.id }
            : { id: r.id, ok: false, error: single.error ?? 'Failed to send email' }
        );
        await sleep(550);
      }
    }

    // Record the outcome; if the write itself fails, try once more before the 5-minute requeue has to rescue it.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error: completeError } = await supabase.rpc('marketing_complete_batch', { p_results: outcomes });
      if (!completeError) break;
      console.error('Queue worker: could not record results:', completeError);
      await sleep(1000);
    }
    sentThisRun += outcomes.filter((o) => o.ok !== null).length;
  }

  console.log(`Queue worker finished after ${sentThisRun} email(s)`);
}

function startWorker(supabase: any, resendApiKey: string | undefined) {
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured: queue worker not started');
    return;
  }
  const job = runQueueWorker(supabase, resendApiKey).catch((error) => {
    console.error('Queue worker crashed:', error);
  });
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === 'function') {
    runtime.waitUntil(job); // keep running after the response has been sent
  }
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `about ${hours} hour${hours === 1 ? '' : 's'}${rest ? ` ${rest} min` : ''}`;
}

function estimateSeconds(emails: number, batchSize: number, delaySeconds: number): number {
  return Math.max(0, Math.ceil(emails / Math.max(1, batchSize)) - 1) * delaySeconds + 5;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Internal call from the per-minute cron (service role key): it may only wake the queue worker.
    if (supabaseServiceKey && token === supabaseServiceKey) {
      const internalBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      if (internalBody?.action !== 'process_queue') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      startWorker(createClient(supabaseUrl, supabaseServiceKey), resendApiKey);
      return new Response(JSON.stringify({ success: true, message: 'Queue worker started' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Check if user has marketing permissions
    const { data: isSuperAdmin } = await supabaseAuth.rpc('is_super_admin');
    if (!isSuperAdmin) {
      const { data: hasViewPerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'marketing.view' });
      const { data: hasListPerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'marketing.campaigns.list' });
      const { data: hasCreatePerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'marketing.campaigns.create' });
      const { data: hasEditPerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'marketing.campaigns.edit' });
      const { data: hasSendPerm } = await supabaseAuth.rpc('has_permission', { permission_name: 'marketing.campaigns.send' });
      
      if (!hasViewPerm && !hasListPerm && !hasCreatePerm && !hasEditPerm && !hasSendPerm) {
        throw new Error('Unauthorized: Marketing permissions required');
      }
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
      
      console.log('Received action:', body.action);

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
              from_email_id: body.from_email_id || null,
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

      if (body.action === 'update_campaign') {
        const { campaign_id, ...updateData } = body;

        const { data: campaign, error } = await supabase
          .from('marketing_campaigns')
          .update({
            title: updateData.title,
            subject: updateData.subject,
            html_content: updateData.html_content,
            plain_text_content: updateData.plain_text_content || '',
            category: updateData.category,
            from_email_id: updateData.from_email_id || null,
            metadata: updateData.metadata || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaign_id)
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

        const { campaign_id, recipient_filters, batch_size } = body;

        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .select('id, status, metadata, send_delay_seconds, batch_size')
          .eq('id', campaign_id)
          .single();

        if (campaignError) throw campaignError;

        const chosenBatchSize = Number.isInteger(batch_size) && batch_size! >= 1 && batch_size! <= 100
          ? (batch_size as number)
          : (campaign.batch_size || 50);

        const requested = recipient_filters?.segment_id || recipient_filters?.segment;
        if (!requested || typeof requested !== 'string') {
          throw new Error('Choose a target audience');
        }
        const isCustomSegment = UUID_RE.test(requested);
        const segment = isCustomSegment
          ? 'custom'
          : (requested === 'all_active' || requested === 'kyc_verified' ? 'all' : requested);

        // Queue every matching user in ONE statement (no row limit). Anyone already in this campaign is skipped,
        // so pressing Send twice, or topping up an older campaign, never emails the same person twice.
        const { data: enqueued, error: enqueueError } = await supabase.rpc('marketing_enqueue_recipients', {
          p_campaign_id: campaign_id,
          p_segment: segment,
          p_segment_id: isCustomSegment ? requested : null,
        });
        if (enqueueError) throw new Error(`Could not queue recipients: ${enqueueError.message}`);

        const queuedNow = Number(enqueued?.queued ?? 0);
        const inSegment = Number(enqueued?.in_segment ?? 0);

        const { count: openCount, error: openError } = await supabase
          .from('campaign_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign_id)
          .in('status', ['pending', 'sending']);
        if (openError) throw openError;
        const open = openCount ?? 0;

        if (open === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              message: inSegment === 0
                ? 'No users with a valid email address were found for the selected audience.'
                : 'Everyone in this audience has already received this campaign.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { count: totalCount } = await supabase
          .from('campaign_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign_id);

        const { error: updateError } = await supabase
          .from('marketing_campaigns')
          .update({
            status: 'sending',
            queue_enabled: true,
            next_send_at: null,
            recipient_count: totalCount ?? open,
            batch_size: chosenBatchSize,
            scheduled_at: null,
            metadata: { ...(campaign.metadata || {}), recipient_filters },
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaign_id);
        if (updateError) throw updateError;
        await supabase.rpc('marketing_recount', { p_campaign_id: campaign_id });

        startWorker(supabase, resendApiKey);

        const delay = campaign.send_delay_seconds || 10;
        return new Response(
          JSON.stringify({
            success: true,
            queued: queuedNow,
            waiting: open,
            skipped: Math.max(0, inSegment - queuedNow),
            message: `${open.toLocaleString('en-US')} email${open === 1 ? '' : 's'} queued. They go out in batches of ${chosenBatchSize} with ${delay} seconds between batches, in the background. That takes ${formatDuration(estimateSeconds(open, chosenBatchSize, delay))}. You can close this page.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      if (body.action === 'retry_campaign') {
        if (!resendApiKey) {
          throw new Error('RESEND_API_KEY not configured');
        }

        const { campaign_id, recipient_ids } = body;

        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .select('id, send_delay_seconds, batch_size')
          .eq('id', campaign_id)
          .single();
        if (campaignError) throw campaignError;

        // Failed, waiting and stuck recipients go back in the queue; the worker sends them at the same pace as a new send.
        const { data: requeued, error: requeueError } = await supabase.rpc('marketing_requeue_recipients', {
          p_campaign_id: campaign_id,
          p_recipient_ids: recipient_ids && recipient_ids.length > 0 ? recipient_ids : null,
        });
        if (requeueError) throw new Error(`Failed to retry emails: ${requeueError.message}`);

        const count = Number(requeued ?? 0);
        if (count === 0) {
          return new Response(
            JSON.stringify({ success: true, message: 'No failed or waiting recipients to retry.', retried: 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        startWorker(supabase, resendApiKey);

        const delay = campaign.send_delay_seconds || 10;
        return new Response(
          JSON.stringify({
            success: true,
            retried: count,
            message: `${count.toLocaleString('en-US')} email${count === 1 ? '' : 's'} re-queued. They go out in batches of ${campaign.batch_size || 50} with ${delay} seconds between batches (${formatDuration(estimateSeconds(count, campaign.batch_size || 50, delay))}).`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.action === 'delete_campaigns') {
        const { campaign_ids } = body;

        if (!campaign_ids || campaign_ids.length === 0) {
          throw new Error('No campaign IDs provided');
        }

        // Delete campaign recipients first (cascade should handle this, but being explicit)
        const { error: recipientsError } = await supabase
          .from('campaign_recipients')
          .delete()
          .in('campaign_id', campaign_ids);

        if (recipientsError) {
          console.error('Error deleting campaign recipients:', recipientsError);
          throw new Error(`Failed to delete campaign recipients: ${recipientsError.message}`);
        }

        // Delete campaigns
        const { error: deleteError } = await supabase
          .from('marketing_campaigns')
          .delete()
          .in('id', campaign_ids);

        if (deleteError) {
          console.error('Error deleting campaigns:', deleteError);
          throw new Error(`Failed to delete campaigns: ${deleteError.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Successfully deleted ${campaign_ids.length} campaign(s)`,
            deleted_count: campaign_ids.length,
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      console.error('Invalid action received:', (body as { action?: string }).action);
      throw new Error(`Invalid action: ${(body as { action?: string }).action}`);
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
