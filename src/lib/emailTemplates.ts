/**
 * Basic email templates for marketing campaigns.
 * Each template includes subject and HTML content.
 */

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  html_content: string;
}

const baseStyles = `
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6; }
  .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
  .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px 30px; text-align: center; color: #ffffff; }
  .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
  .content { padding: 40px 30px; color: #333333; }
  .greeting { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #1e3a8a; }
  .cta-button { display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff !important; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
  .footer { background-color: #1f2937; color: #ffffff; padding: 30px; text-align: center; font-size: 14px; }
  .footer a { color: #60a5fa; text-decoration: none; }
  .signature { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
  .signature .name { font-weight: 600; color: #1e3a8a; font-size: 16px; }
  .signature .signature-title { font-size: 14px; color: #6b7280; margin-top: 2px; }
  @media only screen and (max-width: 600px) { .content { padding: 30px 20px; } .header { padding: 30px 20px; } .header h1 { font-size: 24px; } }
`;

const emailSignature = `
<div class="signature">
  <p>Warm Regards,</p>
  <p class="name">Daniel Uduogu</p>
  <p class="signature-title">Customer Success - Planmoni</p>
</div>`;

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'retention',
    name: 'Retention',
    description: 'Re-engage users and bring them back to Planmoni',
    subject: 'We Miss You – Your Plans Are Waiting on Planmoni',
    html_content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>We Miss You</title><style>${baseStyles}</style></head><body><div class="email-container"><div class="header"><h1>We Miss You!</h1></div><div class="content"><div class="greeting">Hello,</div><p>It's been a while since we've seen you on Planmoni. We hope you're doing well.</p><p>Your savings goals and plans are still here – ready whenever you are. Whether you want to top up an existing plan, check your progress, or start something new, we're here to help you stay on track.</p><p><strong>Why come back?</strong></p><ul><li>Pick up where you left off with your plans</li><li>Add funds securely and grow your savings</li><li>See how close you are to your goals</li></ul><p><a href="https://onelink.to/zua7ze" class="cta-button">Open Planmoni</a></p><p>We'd love to have you back. If there's anything we can do to help, just reply to this email.</p>${emailSignature}</div><div class="footer"><p>© Planmoni. All rights reserved.</p></div></div></body></html>`,
  },
  {
    id: 'platform_issues',
    name: 'Having issues?',
    description: 'Reach out to users experiencing problems with Planmoni',
    subject: 'Having Issues? We’re Here to Help – Planmoni Support',
    html_content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Having Issues? We're Here to Help</title><style>${baseStyles}</style></head><body><div class="email-container"><div class="header"><h1>Having Issues? We're Here to Help</h1></div><div class="content"><div class="greeting">Hello,</div><p>We noticed you may be having trouble using Planmoni. We're sorry for any frustration – we're here to get things working smoothly for you.</p><p><strong>How we can help:</strong></p><ul><li>Technical issues – login, app crashes, or errors</li><li>Plans and payouts – understanding your plan or withdrawal</li><li>Account or verification – KYC, security, or profile</li></ul><p>Reply to this email with a short description of the issue, and our team will get back to you as soon as possible. You can also reach us in-app via the Help or Support section.</p><p><a href="https://onelink.to/zua7ze" class="cta-button">Open Planmoni</a></p><p>Thank you for your patience. We're committed to making Planmoni work for you.</p>${emailSignature}</div><div class="footer"><p>© Planmoni. All rights reserved.</p></div></div></body></html>`,
  },
  {
    id: 'promotional',
    name: 'Promotional',
    description: 'Special offer or promotion',
    subject: 'Exclusive Offer for Planmoni Users',
    html_content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Special Offer</title><style>${baseStyles}</style></head><body><div class="email-container"><div class="header"><h1>Special Offer Inside</h1></div><div class="content"><div class="greeting">Hello,</div><p>As a valued Planmoni user, we're delighted to share a special offer with you.</p><p><strong>Plan your finances with confidence.</strong> Use Planmoni to set goals, automate savings, and stay on track.</p><p>Ready to take the next step? Tap the button below to open the app and explore.</p><p><a href="https://onelink.to/zua7ze" class="cta-button">Claim Offer</a></p><p>This offer is available for a limited time. Don't miss out!</p>${emailSignature}</div><div class="footer"><p>© Planmoni. All rights reserved.</p></div></div></body></html>`,
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Monthly or general update',
    subject: 'Your Planmoni Monthly Update',
    html_content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Monthly Update</title><style>${baseStyles}</style></head><body><div class="email-container"><div class="header"><h1>Your Monthly Update</h1></div><div class="content"><div class="greeting">Hello,</div><p>Here’s your monthly digest from Planmoni.</p><p><strong>Tips for this month:</strong></p><ul><li>Review your active plans and adjust if needed</li><li>Set a new savings goal for the month ahead</li><li>Check your transaction history to stay on track</li></ul><p>We're here to support your financial journey. Log in anytime to manage your plans.</p><p><a href="https://onelink.to/zua7ze" class="cta-button">Open Planmoni</a></p>${emailSignature}</div><div class="footer"><p>© Planmoni. All rights reserved.</p></div></div></body></html>`,
  },
  {
    id: 'thank_you',
    name: 'Thank You / Feedback',
    description: 'Thank users or request feedback',
    subject: "Thank You – We'd Love to Hear From You",
    html_content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Thank You</title><style>${baseStyles}</style></head><body><div class="email-container"><div class="header"><h1>Thank You!</h1></div><div class="content"><div class="greeting">Hello,</div><p>Thank you for being part of the Planmoni community. Your trust means a lot to us.</p><p>We're always working to improve. If you have a moment, we'd love to hear your feedback – what you like, what we could do better, or any ideas you have.</p><p>Your input helps us build a better product for you and everyone else.</p><p><a href="https://onelink.to/zua7ze" class="cta-button">Share Feedback</a></p><p>Thanks again for choosing Planmoni.</p>${emailSignature}</div><div class="footer"><p>© Planmoni. All rights reserved.</p></div></div></body></html>`,
  },
];
