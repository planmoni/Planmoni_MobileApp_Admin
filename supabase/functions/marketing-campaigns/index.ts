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

interface UpdateCampaignRequest {
  action: 'update_campaign';
  campaign_id: string;
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

interface RetryCampaignRequest {
  action: 'retry_campaign';
  campaign_id: string;
  recipient_ids?: string[]; // Optional: retry specific recipients, or all failed/pending if not provided
}

type RequestBody = CreateCampaignRequest | UpdateCampaignRequest | SendCampaignRequest | ScheduleCampaignRequest | RetryCampaignRequest;

async function sendEmailViaResend(
  to: string,
  subject: string,
  htmlContent: string,
  resendApiKey: string,
  fromEmail?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
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

        const { campaign_id, recipient_filters } = body;

        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('id', campaign_id)
          .single();

        if (campaignError) throw campaignError;

        // Fetch the sender email address
        let fromEmailAddress = 'Martins Osodi - Planmoni CEO <hello@planmoni.com>'; // Default fallback
        if (campaign.from_email_id) {
          const { data: senderEmail } = await supabase
            .from('sender_email_addresses')
            .select('email, display_name, is_active')
            .eq('id', campaign.from_email_id)
            .single();

          if (senderEmail && senderEmail.is_active) {
            fromEmailAddress = `${senderEmail.display_name} <${senderEmail.email}>`;
          }
        } else {
          // Fallback to default email if no from_email_id is set
          const { data: defaultEmail } = await supabase
            .from('sender_email_addresses')
            .select('email, display_name')
            .eq('is_default', true)
            .eq('is_active', true)
            .single();

          if (defaultEmail) {
            fromEmailAddress = `${defaultEmail.display_name} <${defaultEmail.email}>`;
          }
        }

        let recipients: any[] = [];
        const segmentId = recipient_filters.segment_id || recipient_filters.segment;
        
        console.log('Sending campaign to segment:', segmentId);

        // Handle predefined segments
        if (segmentId === 'all') {
          const { data, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name');
          
          if (profilesError) {
            console.error('Error fetching all profiles:', profilesError);
            throw new Error(`Failed to fetch recipients: ${profilesError.message}`);
          }
          
          recipients = data || [];
        } else if (segmentId === 'active_users') {
          // Users with active payout plans OR transactions in last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const [activePlans, recentTransactions] = await Promise.all([
            supabase
              .from('payout_plans')
              .select('user_id')
              .eq('status', 'active'),
            supabase
              .from('transactions')
              .select('user_id')
              .gte('created_at', thirtyDaysAgo.toISOString())
          ]);

          const activeUserIds = new Set();
          activePlans.data?.forEach((p: any) => activeUserIds.add(p.user_id));
          recentTransactions.data?.forEach((t: any) => activeUserIds.add(t.user_id));

          if (activeUserIds.size > 0) {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .in('id', Array.from(activeUserIds));
            
            if (error) {
              console.error('Error fetching active users:', error);
              throw new Error(`Failed to fetch active users: ${error.message}`);
            }
            
            recipients = data || [];
          }
        } else if (segmentId === 'users_with_balance') {
          // Users with wallet balance > 0
          const { data: wallets } = await supabase
            .from('wallets')
            .select('user_id')
            .gt('balance', 0);

          const userIds = wallets?.map((w: any) => w.user_id) || [];
          if (userIds.length > 0) {
            const { data } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .in('id', userIds);
            recipients = data || [];
          }
        } else if (segmentId === 'users_with_plans') {
          // Users with active payout plans
          const { data: activePlans } = await supabase
            .from('payout_plans')
            .select('user_id')
            .eq('status', 'active');

          const userIds = [...new Set(activePlans?.map((p: any) => p.user_id) || [])];
          if (userIds.length > 0) {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .in('id', userIds);
            
            if (error) {
              console.error('Error fetching users with plans:', error);
              throw new Error(`Failed to fetch users with plans: ${error.message}`);
            }
            
            recipients = data || [];
          }
        } else if (segmentId === 'kyc_tier_0') {
          // Users without any KYC tier completed
          const { data: allUsers, error: allUsersError } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name');
          
          if (allUsersError) {
            console.error('Error fetching all users for KYC tier 0:', allUsersError);
            throw new Error(`Failed to fetch users: ${allUsersError.message}`);
          }
          
          const { data: kycProgress, error: kycError } = await supabase
            .from('kyc_progress')
            .select('user_id')
            .or('tier_1_completed.eq.true,tier_2_completed.eq.true,tier_3_completed.eq.true');

          if (kycError) {
            console.error('Error fetching KYC progress:', kycError);
            throw new Error(`Failed to fetch KYC progress: ${kycError.message}`);
          }

          const usersWithKyc = new Set(kycProgress?.map((k: any) => k.user_id) || []);
          recipients = (allUsers || []).filter((u: any) => !usersWithKyc.has(u.id));
        } else if (segmentId === 'kyc_tier_1') {
          // Users with tier 1 completed
          const { data: kycProgress, error: kycError } = await supabase
            .from('kyc_progress')
            .select('user_id')
            .eq('tier_1_completed', true);

          if (kycError) {
            console.error('Error fetching KYC tier 1 progress:', kycError);
            throw new Error(`Failed to fetch KYC tier 1 progress: ${kycError.message}`);
          }

          const userIds = kycProgress?.map((k: any) => k.user_id) || [];
          if (userIds.length > 0) {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .in('id', userIds);
            
            if (error) {
              console.error('Error fetching KYC tier 1 users:', error);
              throw new Error(`Failed to fetch KYC tier 1 users: ${error.message}`);
            }
            
            recipients = data || [];
          }
        } else if (segmentId === 'kyc_tier_2') {
          // Users with tier 2 completed
          const { data: kycProgress, error: kycError } = await supabase
            .from('kyc_progress')
            .select('user_id')
            .eq('tier_2_completed', true);

          if (kycError) {
            console.error('Error fetching KYC tier 2 progress:', kycError);
            throw new Error(`Failed to fetch KYC tier 2 progress: ${kycError.message}`);
          }

          const userIds = kycProgress?.map((k: any) => k.user_id) || [];
          if (userIds.length > 0) {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .in('id', userIds);
            
            if (error) {
              console.error('Error fetching KYC tier 2 users:', error);
              throw new Error(`Failed to fetch KYC tier 2 users: ${error.message}`);
            }
            
            recipients = data || [];
          }
        } else if (segmentId === 'kyc_tier_3') {
          // Users with tier 3 completed
          const { data: kycProgress, error: kycError } = await supabase
            .from('kyc_progress')
            .select('user_id')
            .eq('tier_3_completed', true);

          if (kycError) {
            console.error('Error fetching KYC tier 3 progress:', kycError);
            throw new Error(`Failed to fetch KYC tier 3 progress: ${kycError.message}`);
          }

          const userIds = kycProgress?.map((k: any) => k.user_id) || [];
          if (userIds.length > 0) {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .in('id', userIds);
            
            if (error) {
              console.error('Error fetching KYC tier 3 users:', error);
              throw new Error(`Failed to fetch KYC tier 3 users: ${error.message}`);
            }
            
            recipients = data || [];
          }
        } else if (segmentId === 'users_with_zero_balance') {
          // Users with wallet balance = 0 or no wallet (using RPC function to bypass RLS)
          // Use supabaseAuth (user context) instead of supabase (service role) so permission checks work
          const { data, error } = await supabaseAuth.rpc('get_users_with_zero_balance');

          if (error) {
            console.error('Error fetching users with zero balance:', error);
            throw new Error(`Failed to fetch users with zero balance: ${error.message}`);
          }
          
          recipients = data || [];
        } else if (segmentId && segmentId !== 'all') {
          // Custom segment from campaign_segments table
          const { data: segment, error: segmentError } = await supabase
            .from('campaign_segments')
            .select('filters')
            .eq('id', segmentId)
            .single();

          if (segmentError) {
            console.error('Error fetching custom segment:', segmentError);
            throw new Error(`Failed to fetch custom segment: ${segmentError.message}`);
          }

          if (segment) {
            let query = supabase.from('profiles').select('id, email, first_name, last_name');

            if (segment.filters.kyc_status) {
              query = query.eq('kyc_status', segment.filters.kyc_status);
            }

            if (segment.filters.has_payout_plan) {
              const { data: activePlans, error: plansError } = await supabase
                .from('payout_plans')
                .select('user_id')
                .eq('status', 'active');

              if (plansError) {
                console.error('Error fetching active plans for custom segment:', plansError);
                throw new Error(`Failed to fetch active plans: ${plansError.message}`);
              }

              const userIds = activePlans?.map((p) => p.user_id) || [];
              if (userIds.length > 0) {
                query = query.in('id', userIds);
              }
            }

            const { data, error: queryError } = await query;
            
            if (queryError) {
              console.error('Error querying profiles for custom segment:', queryError);
              throw new Error(`Failed to query profiles: ${queryError.message}`);
            }
            
            recipients = data || [];
          }
        } else {
          // Legacy support for old format
          if (recipient_filters.segment === 'all_active' || recipient_filters.segment === 'kyc_verified') {
            const { data } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name');
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
        }

        // Filter out recipients without valid email addresses
        const validRecipients = recipients.filter((r: any) => r.email && r.email.trim() !== '');
        
        console.log(`Found ${recipients.length} total recipients, ${validRecipients.length} with valid emails`);
        
        if (validRecipients.length === 0) {
          console.error('No valid recipients found. Segment:', segmentId, 'Total recipients:', recipients.length);
          return new Response(
            JSON.stringify({
              success: false,
              message: `No recipients found with valid email addresses for the selected segment. Found ${recipients.length} users but none have valid email addresses.`,
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        const recipientRecords = validRecipients.map((r) => ({
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

          // Optimized sending logic with smaller batches and faster processing
          const BATCH_SIZE = 25; // Increased batch size for faster processing
          const DELAY_BETWEEN_BATCHES = 1000; // Reduced to 1 second between batches
          const MAX_RETRIES = 2; // Reduced retries to speed up
          const RETRY_DELAY = 3000; // Reduced retry delay to 3 seconds

          let sentCount = 0;
          let deliveredCount = 0;
          let failedCount = 0;

          // Helper function to send email with retry logic (simplified for speed)
          const sendEmailWithRetry = async (
            recipient: any,
            retryCount = 0
          ): Promise<{ success: boolean; id?: string; error?: string }> => {
            try {
              const result = await sendEmailViaResend(
                recipient.email,
                campaign.subject,
                campaign.html_content,
                resendApiKey,
                fromEmailAddress
              );

              if (result.success) {
                return result;
              }

              // If failed and we have retries left, wait and retry
              if (retryCount < MAX_RETRIES) {
                console.log(`Retrying email to ${recipient.email} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                return sendEmailWithRetry(recipient, retryCount + 1);
              }

              return result;
            } catch (error) {
              // If error and we have retries left, wait and retry
              if (retryCount < MAX_RETRIES) {
                console.log(`Retrying email to ${recipient.email} after error (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                return sendEmailWithRetry(recipient, retryCount + 1);
              }

              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          };

          // Process recipients in batches with better error handling
          try {
            for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
              const batch = validRecipients.slice(i, i + BATCH_SIZE);
              console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validRecipients.length / BATCH_SIZE)} (${batch.length} emails)`);
              
              const batchPromises = batch.map(async (recipient) => {
                try {
                  const result = await sendEmailWithRetry(recipient);

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
                        updated_at: new Date().toISOString(),
                      })
                      .eq('campaign_id', campaign_id)
                      .eq('user_id', recipient.id);
                  } else {
                    failedCount++;

                    await supabase
                      .from('campaign_recipients')
                      .update({
                        status: 'failed',
                        error_message: result.error || 'Failed to send email',
                        sent_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      })
                      .eq('campaign_id', campaign_id)
                      .eq('user_id', recipient.id);
                  }
                } catch (error) {
                  console.error(`Error sending email to ${recipient.email}:`, error);
                  failedCount++;
                  await supabase
                    .from('campaign_recipients')
                    .update({
                      status: 'failed',
                      error_message: error instanceof Error ? error.message : 'Unknown error',
                      sent_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('campaign_id', campaign_id)
                    .eq('user_id', recipient.id);
                }
              });

              // Wait for all emails in batch to complete
              await Promise.all(batchPromises);

              // Update campaign progress after each batch
              await supabase
                .from('marketing_campaigns')
                .update({
                  delivered_count: deliveredCount,
                  failed_count: failedCount,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', campaign_id);

              console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} complete: ${deliveredCount} delivered, ${failedCount} failed`);

              // Delay between batches (except for the last batch)
              if (i + BATCH_SIZE < validRecipients.length) {
                await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
              }
            }

            // Mark campaign as sent after all emails are processed
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

            console.log(`Campaign ${campaign_id} completed: ${deliveredCount} delivered, ${failedCount} failed`);

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
          } catch (error) {
            console.error(`Error processing campaign ${campaign_id}:`, error);
            // Update campaign status to indicate partial completion
            await supabase
              .from('marketing_campaigns')
              .update({
                status: 'sending', // Keep as sending so it can be retried
                delivered_count: deliveredCount,
                failed_count: failedCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', campaign_id);

            throw new Error(`Failed to send all emails: ${error instanceof Error ? error.message : 'Unknown error'}. ${deliveredCount} sent successfully.`);
          }
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

      if (body.action === 'retry_campaign') {
        if (!resendApiKey) {
          throw new Error('RESEND_API_KEY not configured');
        }

        const { campaign_id, recipient_ids } = body;

        // Fetch campaign details
        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('id', campaign_id)
          .single();

        if (campaignError) throw campaignError;

        // Fetch sender email address
        let fromEmailAddress = 'Martins Osodi - Planmoni CEO <hello@planmoni.com>';
        if (campaign.from_email_id) {
          const { data: senderEmail } = await supabase
            .from('sender_email_addresses')
            .select('email, display_name, is_active')
            .eq('id', campaign.from_email_id)
            .single();

          if (senderEmail && senderEmail.is_active) {
            fromEmailAddress = `${senderEmail.display_name} <${senderEmail.email}>`;
          }
        } else {
          const { data: defaultEmail } = await supabase
            .from('sender_email_addresses')
            .select('email, display_name')
            .eq('is_default', true)
            .eq('is_active', true)
            .single();

          if (defaultEmail) {
            fromEmailAddress = `${defaultEmail.display_name} <${defaultEmail.email}>`;
          }
        }

        // Fetch recipients to retry (failed or pending, or specific IDs if provided)
        let recipientsQuery = supabase
          .from('campaign_recipients')
          .select('id, user_id, email, status')
          .eq('campaign_id', campaign_id);

        if (recipient_ids && recipient_ids.length > 0) {
          // Retry specific recipients
          recipientsQuery = recipientsQuery.in('id', recipient_ids);
        } else {
          // Retry all failed or pending recipients
          recipientsQuery = recipientsQuery.in('status', ['failed', 'pending']);
        }

        const { data: recipientsToRetry, error: recipientsError } = await recipientsQuery;

        if (recipientsError) throw recipientsError;

        if (!recipientsToRetry || recipientsToRetry.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'No recipients found to retry',
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Mark recipients as pending
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'pending',
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .in('id', recipientsToRetry.map((r: any) => r.id));

        // Update campaign status to sending
        await supabase
          .from('marketing_campaigns')
          .update({
            status: 'sending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaign_id);

        // Process retry emails
        const BATCH_SIZE = 25;
        const DELAY_BETWEEN_BATCHES = 1000;
        const MAX_RETRIES = 2;
        const RETRY_DELAY = 3000;

        let deliveredCount = 0;
        let failedCount = 0;

        const sendEmailWithRetry = async (
          recipient: any,
          retryCount = 0
        ): Promise<{ success: boolean; id?: string; error?: string }> => {
          try {
            const result = await sendEmailViaResend(
              recipient.email,
              campaign.subject,
              campaign.html_content,
              resendApiKey,
              fromEmailAddress
            );

            if (result.success) {
              return result;
            }

            if (retryCount < MAX_RETRIES) {
              console.log(`Retrying email to ${recipient.email} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
              return sendEmailWithRetry(recipient, retryCount + 1);
            }

            return result;
          } catch (error) {
            if (retryCount < MAX_RETRIES) {
              console.log(`Retrying email to ${recipient.email} after error (attempt ${retryCount + 1}/${MAX_RETRIES})`);
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
              return sendEmailWithRetry(recipient, retryCount + 1);
            }

            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        };

        try {
          for (let i = 0; i < recipientsToRetry.length; i += BATCH_SIZE) {
            const batch = recipientsToRetry.slice(i, i + BATCH_SIZE);
            console.log(`Retrying batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipientsToRetry.length / BATCH_SIZE)} (${batch.length} emails)`);

            const batchPromises = batch.map(async (recipient: any) => {
              try {
                const result = await sendEmailWithRetry(recipient);

                if (result.success) {
                  deliveredCount++;

                  await supabase
                    .from('campaign_recipients')
                    .update({
                      status: 'delivered',
                      sent_at: new Date().toISOString(),
                      delivered_at: new Date().toISOString(),
                      metadata: { resend_id: result.id },
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', recipient.id);
                } else {
                  failedCount++;

                  await supabase
                    .from('campaign_recipients')
                    .update({
                      status: 'failed',
                      error_message: result.error || 'Failed to send email',
                      sent_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', recipient.id);
                }
              } catch (error) {
                console.error(`Error retrying email to ${recipient.email}:`, error);
                failedCount++;
                await supabase
                  .from('campaign_recipients')
                  .update({
                    status: 'failed',
                    error_message: error instanceof Error ? error.message : 'Unknown error',
                    sent_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', recipient.id);
              }
            });

            await Promise.all(batchPromises);

            // Update campaign progress
            const { data: currentCampaign } = await supabase
              .from('marketing_campaigns')
              .select('delivered_count, failed_count')
              .eq('id', campaign_id)
              .single();

            await supabase
              .from('marketing_campaigns')
              .update({
                delivered_count: (currentCampaign?.delivered_count || 0) + deliveredCount,
                failed_count: (currentCampaign?.failed_count || 0) + failedCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', campaign_id);

            if (i + BATCH_SIZE < recipientsToRetry.length) {
              await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
          }

          // Check if all recipients are processed
          const { data: remainingRecipients } = await supabase
            .from('campaign_recipients')
            .select('id')
            .eq('campaign_id', campaign_id)
            .in('status', ['pending', 'failed']);

          if (!remainingRecipients || remainingRecipients.length === 0) {
            await supabase
              .from('marketing_campaigns')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', campaign_id);
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: `Retried ${recipientsToRetry.length} recipients: ${deliveredCount} delivered, ${failedCount} failed`,
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
        } catch (error) {
          console.error(`Error retrying campaign ${campaign_id}:`, error);
          throw new Error(`Failed to retry emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.error('Invalid action received:', body.action);
      throw new Error(`Invalid action: ${body.action}`);
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
