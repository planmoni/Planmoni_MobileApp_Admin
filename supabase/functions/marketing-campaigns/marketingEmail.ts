import { ctaButton, escapeHtml, greeting, paragraph, titleBlock, wrapEmail } from '../_shared/email/layout.ts';

// Renders a marketing campaign with the shared Planmoni email layout (same header, footer, fonts and colours as the app emails).

export type MarketingEmailInput = {
  subject: string;
  heading: string;
  body: string;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
};

export type CleanMarketingEmail = {
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
};

export const LIMITS = { subject: 150, heading: 120, body: 5000, buttonLabel: 40, buttonUrl: 500 } as const;

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '');

/** Trims and checks the fields. Throws an Error with a message that is safe to show to the admin. */
export function validateMarketingEmail(input: Partial<MarketingEmailInput> | null | undefined): CleanMarketingEmail {
  const email: CleanMarketingEmail = {
    subject: clean(input?.subject),
    heading: clean(input?.heading),
    body: clean(input?.body),
    buttonLabel: clean(input?.buttonLabel),
    buttonUrl: clean(input?.buttonUrl),
  };

  if (!email.subject) throw new Error('Enter a title (the email subject)');
  if (!email.heading) throw new Error('Enter a heading');
  if (!email.body) throw new Error('Enter the email body');
  if (email.subject.length > LIMITS.subject) throw new Error(`The title can be up to ${LIMITS.subject} characters`);
  if (email.heading.length > LIMITS.heading) throw new Error(`The heading can be up to ${LIMITS.heading} characters`);
  if (email.body.length > LIMITS.body) throw new Error(`The body can be up to ${LIMITS.body} characters`);
  if (/[\r\n]/.test(email.subject)) throw new Error('The title must be one line');

  if (email.buttonLabel || email.buttonUrl) {
    if (!email.buttonLabel || !email.buttonUrl) throw new Error('Enter both a button name and a button link, or leave both empty');
    if (email.buttonLabel.length > LIMITS.buttonLabel) throw new Error(`The button name can be up to ${LIMITS.buttonLabel} characters`);
    if (email.buttonUrl.length > LIMITS.buttonUrl) throw new Error('The button link is too long');
    let url: URL;
    try {
      url = new URL(email.buttonUrl);
    } catch {
      throw new Error('The button link is not a valid web address');
    }
    if (url.protocol !== 'https:') throw new Error('The button link must start with https://');
    email.buttonUrl = url.toString();
  }
  return email;
}

function bodyParagraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    // paragraph() escapes its text; line breaks are swapped for <br /> afterwards through a marker it leaves alone
    .map((p) => paragraph(p.replace(/\n/g, '\u0001')).replace(/\u0001/g, '<br />'))
    .join('');
}

/** The full HTML document for a campaign. Every field is escaped by the shared layout blocks. */
export function renderMarketingEmail(input: Partial<MarketingEmailInput>): string {
  const e = validateMarketingEmail(input);
  const bodyHtml = `
    ${greeting('there')}
    ${titleBlock(e.heading)}
    ${bodyParagraphs(e.body)}
    ${e.buttonLabel ? ctaButton(e.buttonUrl, e.buttonLabel) : ''}
  `;
  return wrapEmail({ title: e.subject, preheader: e.heading, bodyHtml });
}

/** A plain-text version for clients that do not show HTML. */
export function marketingEmailText(input: Partial<MarketingEmailInput>): string {
  const e = validateMarketingEmail(input);
  const parts = [e.heading, '', e.body];
  if (e.buttonLabel) parts.push('', `${e.buttonLabel}: ${e.buttonUrl}`);
  return parts.join('\n');
}

export { escapeHtml };
