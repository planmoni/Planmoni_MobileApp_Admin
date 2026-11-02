import {
  EMAIL,
  EMAIL_FOOTER_URL,
  EMAIL_HEADER_URL,
  SITE_URL,
  SUPPORT_EMAIL,
} from './tokens.ts';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function iconBlock(
  src: string | null | undefined,
  alt: string,
  size = 56,
): string {
  if (!src) return '';
  return `
    <tr>
      <td align="left" style="padding: 0 0 20px 0;">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;" />
      </td>
    </tr>`;
}

export function amountBlock(amount: string, color: string = EMAIL.figure): string {
  return `
    <tr>
      <td align="left" style="padding: 4px 0 24px 0;font-family:${EMAIL.font};font-size:32px;font-weight:700;line-height:1.2;color:${color};">
        ${escapeHtml(amount)}
      </td>
    </tr>`;
}

export function otpBlock(code: string): string {
  return `
    <tr>
      <td align="left" style="padding: 8px 0 24px 0;font-family:${EMAIL.font};font-size:36px;font-weight:700;letter-spacing:8px;line-height:1.2;color:${EMAIL.primary};">
        ${escapeHtml(code)}
      </td>
    </tr>`;
}

export function detailRow(
  label: string,
  value: string,
  options?: { iconSrc?: string | null; last?: boolean },
): string {
  const border = options?.last
    ? 'none'
    : `1px solid ${EMAIL.border}`;
  const icon = options?.iconSrc
    ? `<img src="${escapeHtml(options.iconSrc)}" alt="" width="20" height="20" style="display:inline-block;vertical-align:middle;margin-right:8px;border:0;width:20px;height:20px;" />`
    : '';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:${border};font-family:${EMAIL.font};font-size:13px;color:${EMAIL.textSecondary};width:38%;vertical-align:middle;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:12px 0;border-bottom:${border};font-family:${EMAIL.font};font-size:14px;font-weight:600;color:${EMAIL.text};text-align:right;vertical-align:middle;">
        ${icon}${escapeHtml(value)}
      </td>
    </tr>`;
}

export function detailsTable(rowsHtml: string): string {
  if (!rowsHtml.trim()) return '';
  return `
    <tr>
      <td style="padding:0 0 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${EMAIL.border};border-radius:12px;">
          <tr>
            <td style="padding:4px 16px;background:${EMAIL.cardBg};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rowsHtml}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function ctaButton(
  href: string,
  label: string,
  variant: 'primary' | 'accent' = 'primary',
): string {
  const bg = variant === 'accent' ? EMAIL.accent : EMAIL.primary;
  const color = variant === 'accent' ? EMAIL.accentText : '#FFFFFF';
  return `
    <tr>
      <td align="left" style="padding: 8px 0 8px 0;">
        <a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:${color};font-family:${EMAIL.font};font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:10px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>`;
}

export function paragraph(text: string): string {
  return `
    <tr>
      <td align="left" style="padding:0 0 16px 0;font-family:${EMAIL.font};font-size:15px;line-height:1.6;color:${EMAIL.textSecondary};">
        ${escapeHtml(text)}
      </td>
    </tr>`;
}

export function titleBlock(title: string): string {
  return `
    <tr>
      <td align="left" style="padding:0 0 12px 0;font-family:${EMAIL.font};font-size:22px;font-weight:700;line-height:1.3;color:${EMAIL.primary};">
        ${escapeHtml(title)}
      </td>
    </tr>`;
}

export function greeting(firstName: string): string {
  const name = firstName?.trim() || 'there';
  return `
    <tr>
      <td align="left" style="padding:0 0 8px 0;font-family:${EMAIL.font};font-size:15px;line-height:1.5;color:${EMAIL.text};">
        Hi ${escapeHtml(name)},
      </td>
    </tr>`;
}

export function alertBox(htmlInner: string, tone: 'warning' | 'error' | 'info' = 'info'): string {
  const border =
    tone === 'error'
      ? EMAIL.error
      : tone === 'warning'
        ? EMAIL.warning
        : EMAIL.primary;
  const bg =
    tone === 'error'
      ? '#FEF2F2'
      : tone === 'warning'
        ? '#FFFBEB'
        : EMAIL.chip;
  return `
    <tr>
      <td style="padding:0 0 20px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-left:4px solid ${border};border-radius:8px;">
          <tr>
            <td style="padding:14px 16px;font-family:${EMAIL.font};font-size:14px;line-height:1.55;color:${EMAIL.text};">
              ${htmlInner}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export type WrapEmailOptions = {
  title: string;
  preheader?: string;
  bodyHtml: string;
};

export function wrapEmail({ title, preheader = '', bodyHtml }: WrapEmailOptions): string {
  const year = new Date().getFullYear();
  const safePreheader = escapeHtml(preheader || title);

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
          <tr>
            <td align="center" style="padding:0;line-height:0;font-size:0;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${EMAIL_HEADER_URL}" alt="Planmoni" width="520" style="display:block;width:100%;max-width:${EMAIL.maxWidth}px;height:auto;border:0;outline:none;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${bodyHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0;line-height:0;font-size:0;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${EMAIL_FOOTER_URL}" alt="Planmoni — banking partners and download the app" width="520" style="display:block;width:100%;max-width:${EMAIL.maxWidth}px;height:auto;border:0;outline:none;" />
              </a>
            </td>
          </tr>
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

export { escapeHtml };
