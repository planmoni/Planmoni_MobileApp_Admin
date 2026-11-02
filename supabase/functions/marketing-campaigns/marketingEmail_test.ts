import { assert, assertThrows } from 'jsr:@std/assert@1';
import { marketingEmailText, renderMarketingEmail, validateMarketingEmail } from './marketingEmail.ts';

const base = { subject: 'Big news', heading: 'Plan your week', body: 'Line one\nLine two\n\nSecond paragraph', buttonLabel: 'Open Planmoni', buttonUrl: 'https://onelink.to/zua7ze' };

Deno.test('renders the shared layout with heading, paragraphs, line breaks and button', () => {
  const html = renderMarketingEmail(base);
  assert(html.startsWith('<!DOCTYPE html>'));
  assert(html.includes('email-header.png') && html.includes('footer-email.png'));
  assert(html.includes('Plan your week'));
  assert(html.includes('Line one<br />Line two'));
  assert(!html.includes('Line two<br />'));
  assert(html.includes('Second paragraph'));
  assert(html.includes('href="https://onelink.to/zua7ze"') && html.includes('Open Planmoni'));
  assert(html.includes('Hi there,'));
  assert(html.includes('<title>Big news</title>'));
});

Deno.test('no button when label and link are empty', () => {
  const html = renderMarketingEmail({ ...base, buttonLabel: '', buttonUrl: '' });
  assert(!html.includes('onelink.to'));
});

Deno.test('everything is escaped', () => {
  const evil = '<script>alert(1)</script> "x" & <img src=x onerror=1>';
  const html = renderMarketingEmail({ subject: evil, heading: evil, body: evil, buttonLabel: '<b>"go"</b> &', buttonUrl: 'https://a.com/?q="><b>' });
  assert(!html.includes('<script>'));
  assert(!html.includes('<img src=x'));
  assert(!html.includes('"><b>'));
  assert(html.includes('&lt;script&gt;'));
});

Deno.test('validation', () => {
  assertThrows(() => validateMarketingEmail({ ...base, subject: '' }), Error, 'title');
  assertThrows(() => validateMarketingEmail({ ...base, heading: ' ' }), Error, 'heading');
  assertThrows(() => validateMarketingEmail({ ...base, body: '' }), Error, 'body');
  assertThrows(() => validateMarketingEmail({ ...base, buttonUrl: '' }), Error, 'both');
  assertThrows(() => validateMarketingEmail({ ...base, buttonLabel: '' }), Error, 'both');
  assertThrows(() => validateMarketingEmail({ ...base, buttonUrl: 'http://x.com' }), Error, 'https://');
  assertThrows(() => validateMarketingEmail({ ...base, buttonUrl: 'javascript:alert(1)' }), Error, 'https://');
  assertThrows(() => validateMarketingEmail({ ...base, buttonUrl: 'not a url' }), Error, 'valid');
  assertThrows(() => validateMarketingEmail({ ...base, subject: 'a\nb' }), Error, 'one line');
  assertThrows(() => validateMarketingEmail({ ...base, body: 'x'.repeat(5001) }), Error, 'body');
});

Deno.test('plain text version', () => {
  const t = marketingEmailText(base);
  assert(t.startsWith('Plan your week'));
  assert(t.includes('Open Planmoni: https://onelink.to/zua7ze'));
});
