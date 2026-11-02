import { ctaButton, escapeHtml, greeting, titleBlock } from '../_shared/email/layout.ts';
import {
  EMAIL,
  EMAIL_FOOTER_URL,
  EMAIL_HEADER_URL,
  SITE_URL,
  SUPPORT_EMAIL,
} from '../_shared/email/tokens.ts';

// Renders a marketing campaign with the shared Planmoni email layout (same header, footer, fonts and colours as the app emails).

export type MarketingEmailInput = {
  subject: string;
  heading: string;
  body: string;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  lowerBody?: string | null;
  bannerUrl?: string | null;
  /** Default true — Planmoni header logo image */
  showHeader?: boolean | null;
  /** Default true — Planmoni footer banner image */
  showFooter?: boolean | null;
};

export type CleanMarketingEmail = {
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  lowerBody: string;
  bannerUrl: string;
  showHeader: boolean;
  showFooter: boolean;
};

export const LIMITS = {
  subject: 150,
  heading: 120,
  body: 5000,
  buttonLabel: 40,
  buttonUrl: 500,
  lowerBody: 5000,
  bannerUrl: 2000,
} as const;

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '');

function boolOrDefault(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function requireHttps(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`The ${label} is not a valid web address`);
  }
  if (url.protocol !== 'https:') throw new Error(`The ${label} must start with https://`);
  return url.toString();
}

/** Trims and checks the fields. Throws an Error with a message that is safe to show to the admin. */
export function validateMarketingEmail(input: Partial<MarketingEmailInput> | null | undefined): CleanMarketingEmail {
  const email: CleanMarketingEmail = {
    subject: clean(input?.subject),
    heading: clean(input?.heading),
    body: clean(input?.body),
    buttonLabel: clean(input?.buttonLabel),
    buttonUrl: clean(input?.buttonUrl),
    lowerBody: clean(input?.lowerBody),
    bannerUrl: clean(input?.bannerUrl),
    showHeader: boolOrDefault(input?.showHeader, true),
    showFooter: boolOrDefault(input?.showFooter, true),
  };

  if (!email.subject) throw new Error('Enter a title (the email subject)');
  if (!email.heading) throw new Error('Enter a heading');
  if (!email.body) throw new Error('Enter the email body');
  if (email.subject.length > LIMITS.subject) throw new Error(`The title can be up to ${LIMITS.subject} characters`);
  if (email.heading.length > LIMITS.heading) throw new Error(`The heading can be up to ${LIMITS.heading} characters`);
  if (email.body.length > LIMITS.body) throw new Error(`The body can be up to ${LIMITS.body} characters`);
  if (email.lowerBody.length > LIMITS.lowerBody) throw new Error(`The lower body can be up to ${LIMITS.lowerBody} characters`);
  if (/[\r\n]/.test(email.subject)) throw new Error('The title must be one line');

  if (email.buttonLabel || email.buttonUrl) {
    if (!email.buttonLabel || !email.buttonUrl) throw new Error('Enter both a button name and a button link, or leave both empty');
    if (email.buttonLabel.length > LIMITS.buttonLabel) throw new Error(`The button name can be up to ${LIMITS.buttonLabel} characters`);
    if (email.buttonUrl.length > LIMITS.buttonUrl) throw new Error('The button link is too long');
    email.buttonUrl = requireHttps(email.buttonUrl, 'button link');
  }

  if (email.bannerUrl) {
    if (email.bannerUrl.length > LIMITS.bannerUrl) throw new Error('The banner image link is too long');
    email.bannerUrl = requireHttps(email.bannerUrl, 'banner image link');
  }

  return email;
}

/**
 * Escapes text, then turns **bold** markers into <strong>.
 * Odd unpaired ** markers are left as literal text (escaped asterisks stay as *).
 */
function formatInline(text: string): string {
  const parts = text.split('**');
  return parts
    .map((part, i) => {
      const escaped = escapeHtml(part).replace(/\n/g, '<br />');
      return i % 2 === 1 ? `<strong>${escaped}</strong>` : escaped;
    })
    .join('');
}

function bodyParagraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) => `
    <tr>
      <td align="left" style="padding:0 0 16px 0;font-family:${EMAIL.font};font-size:15px;line-height:1.6;color:${EMAIL.textSecondary};">
        ${formatInline(p)}
      </td>
    </tr>`
    )
    .join('');
}

/** Full-width banner image above the greeting. */
function bannerBlock(url: string): string {
  return `
    <tr>
      <td align="center" style="padding:0 0 16px 0;">
        <img src="${escapeHtml(url)}" alt="" width="520" style="display:block;width:100%;max-width:${EMAIL.maxWidth}px;height:auto;border:0;outline:none;" />
      </td>
    </tr>`;
}

/**
 * Same chrome as wrapEmail, with optional header logo and footer banner.
 * Kept here so we do not change the shared layout.ts copy.
 */
function wrapCampaignEmail({
  title,
  preheader = '',
  bodyHtml,
  showHeader,
  showFooter,
}: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  showHeader: boolean;
  showFooter: boolean;
}): string {
  const year = new Date().getFullYear();
  const safePreheader = escapeHtml(preheader || title);

  const headerRow = showHeader
    ? `
          <tr>
            <td align="center" style="padding:0;line-height:0;font-size:0;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${EMAIL_HEADER_URL}" alt="Planmoni" width="520" style="display:block;width:100%;max-width:${EMAIL.maxWidth}px;height:auto;border:0;outline:none;" />
              </a>
            </td>
          </tr>`
    : '';

  const footerRow = showFooter
    ? `
          <tr>
            <td align="center" style="padding:0;line-height:0;font-size:0;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${EMAIL_FOOTER_URL}" alt="Planmoni — banking partners and download the app" width="520" style="display:block;width:100%;max-width:${EMAIL.maxWidth}px;height:auto;border:0;outline:none;" />
              </a>
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${EMAIL.pageBg};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${safePreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.pageBg};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${EMAIL.maxWidth}px;background:${EMAIL.cardBg};">
          ${headerRow}
          <tr>
            <td style="padding:28px 28px 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${bodyHtml}
              </table>
            </td>
          </tr>
          ${footerRow}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${EMAIL.maxWidth}px;">
          <tr>
            <td align="center" style="padding:16px 28px 28px 28px;font-family:${EMAIL.font};font-size:12px;line-height:1.6;color:${EMAIL.textSecondary};">
              <a href="${SITE_URL}/help" style="color:${EMAIL.primary};text-decoration:none;">Help</a>
              &nbsp;·&nbsp;
              <a href="mailto:${SUPPORT_EMAIL}" style="color:${EMAIL.primary};text-decoration:none;">Support</a>
              &nbsp;·&nbsp;
              <a href="${SITE_URL}/settings" style="color:${EMAIL.primary};text-decoration:none;">Email preferences</a>
              <br />
              &copy; ${year} Planmoni. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Strip **bold** markers for the plain-text version. */
function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*/g, '');
}

/** Left in the stored HTML; replaced with each recipient's first name at send time. */
export const FIRST_NAME_PLACEHOLDER = '{{FIRST_NAME}}';

/**
 * Swap the greeting placeholder for a real first name (escaped). Missing names become "there".
 * Safe to call on older campaigns that still say "Hi there," — those are left unchanged.
 */
export function personalizeMarketingHtml(html: string, firstName?: string | null): string {
  if (!html.includes(FIRST_NAME_PLACEHOLDER)) return html;
  const name = firstName?.trim() || 'there';
  return html.split(FIRST_NAME_PLACEHOLDER).join(escapeHtml(name));
}

/** The full HTML document for a campaign. Every field is escaped; **bold** becomes <strong>. */
export function renderMarketingEmail(input: Partial<MarketingEmailInput>): string {
  const e = validateMarketingEmail(input);
  const bodyHtml = `
    ${e.bannerUrl ? bannerBlock(e.bannerUrl) : ''}
    ${greeting(FIRST_NAME_PLACEHOLDER)}
    ${titleBlock(e.heading)}
    ${bodyParagraphs(e.body)}
    ${e.buttonLabel ? ctaButton(e.buttonUrl, e.buttonLabel) : ''}
    ${e.lowerBody ? bodyParagraphs(e.lowerBody) : ''}
  `;
  return wrapCampaignEmail({
    title: e.subject,
    preheader: e.heading,
    bodyHtml,
    showHeader: e.showHeader,
    showFooter: e.showFooter,
  });
}

/** A plain-text version for clients that do not show HTML. */
export function marketingEmailText(input: Partial<MarketingEmailInput>): string {
  const e = validateMarketingEmail(input);
  const parts = [e.heading, '', stripBoldMarkers(e.body)];
  if (e.buttonLabel) parts.push('', `${e.buttonLabel}: ${e.buttonUrl}`);
  if (e.lowerBody) parts.push('', stripBoldMarkers(e.lowerBody));
  return parts.join('\n');
}

export { escapeHtml };
