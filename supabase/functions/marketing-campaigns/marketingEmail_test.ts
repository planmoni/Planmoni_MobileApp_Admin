import { assert, assertThrows } from 'jsr:@std/assert@1';
import {
  FIRST_NAME_PLACEHOLDER,
  marketingEmailText,
  personalizeMarketingHtml,
  renderMarketingEmail,
  validateMarketingEmail,
} from './marketingEmail.ts';

const base = {
  subject: 'Big news',
  heading: 'Plan your week',
  body: 'Line one\nLine two\n\nSecond paragraph',
  buttonLabel: 'Open Planmoni',
  buttonUrl: 'https://onelink.to/zua7ze',
};

Deno.test('renders the shared layout with heading, paragraphs, line breaks and button', () => {
  const html = renderMarketingEmail(base);
  assert(html.startsWith('<!DOCTYPE html>'));
  assert(html.includes('email-header.png') && html.includes('footer-email.png'));
  assert(html.includes('Plan your week'));
  assert(html.includes('Line one<br />Line two'));
  assert(!html.includes('Line two<br />'));
  assert(html.includes('Second paragraph'));
  assert(html.includes('href="https://onelink.to/zua7ze"') && html.includes('Open Planmoni'));
  assert(html.includes(`Hi ${FIRST_NAME_PLACEHOLDER},`));
  assert(html.includes('<title>Big news</title>'));
});

Deno.test('personalize replaces the first-name placeholder', () => {
  const html = personalizeMarketingHtml(renderMarketingEmail(base), 'Ada');
  assert(html.includes('Hi Ada,'));
  assert(!html.includes(FIRST_NAME_PLACEHOLDER));
  assert(personalizeMarketingHtml(renderMarketingEmail(base), null).includes('Hi there,'));
  assert(personalizeMarketingHtml(renderMarketingEmail(base), ' <b>x').includes('Hi &lt;b&gt;x,'));
});

Deno.test('no button when label and link are empty', () => {
  const html = renderMarketingEmail({ ...base, buttonLabel: '', buttonUrl: '' });
  assert(!html.includes('onelink.to'));
});

Deno.test('lower body appears after the button', () => {
  const html = renderMarketingEmail({ ...base, lowerBody: 'See you soon\n\nTeam Planmoni' });
  const buttonIdx = html.indexOf('Open Planmoni');
  const lowerIdx = html.indexOf('See you soon');
  assert(buttonIdx > 0 && lowerIdx > buttonIdx);
  assert(html.includes('Team Planmoni'));
});

Deno.test('lower body works without a button', () => {
  const html = renderMarketingEmail({ ...base, buttonLabel: '', buttonUrl: '', lowerBody: 'Footer note' });
  assert(html.includes('Footer note'));
  assert(!html.includes('onelink.to'));
});

Deno.test('banner sits above the greeting', () => {
  const banner = 'https://example.com/banner.png';
  const html = renderMarketingEmail({ ...base, bannerUrl: banner });
  const bannerIdx = html.indexOf(`src="${banner}"`);
  const greetIdx = html.indexOf(`Hi ${FIRST_NAME_PLACEHOLDER},`);
  assert(bannerIdx > 0 && greetIdx > bannerIdx);
});

Deno.test('banner URL is escaped', () => {
  const html = renderMarketingEmail({ ...base, bannerUrl: 'https://a.com/x.png?"><script>' });
  assert(!html.includes('"><script>'));
  assert(html.includes('&quot;') || html.includes('&#34;') || !html.includes('"><'));
});

Deno.test('header and footer can be turned off', () => {
  const html = renderMarketingEmail({ ...base, showHeader: false, showFooter: false });
  assert(!html.includes('email-header.png'));
  assert(!html.includes('footer-email.png'));
  assert(html.includes(`Hi ${FIRST_NAME_PLACEHOLDER},`));
});

Deno.test('header and footer default to on', () => {
  const email = validateMarketingEmail(base);
  assert(email.showHeader === true);
  assert(email.showFooter === true);
});

Deno.test('**bold** markers become strong tags and stay escaped', () => {
  const html = renderMarketingEmail({ ...base, body: 'Hello **world** and **<script>**' });
  assert(html.includes('<strong>world</strong>'));
  assert(html.includes('<strong>&lt;script&gt;</strong>'));
  assert(!html.includes('<script>'));
});

Deno.test('everything is escaped', () => {
  const evil = '<script>alert(1)</script> "x" & <img src=x onerror=1>';
  const html = renderMarketingEmail({
    subject: evil,
    heading: evil,
    body: evil,
    buttonLabel: '<b>"go"</b> &',
    buttonUrl: 'https://a.com/?q="><b>',
    lowerBody: evil,
  });
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
  assertThrows(() => validateMarketingEmail({ ...base, lowerBody: 'x'.repeat(5001) }), Error, 'lower body');
  assertThrows(() => validateMarketingEmail({ ...base, bannerUrl: 'http://x.com/a.png' }), Error, 'https://');
  assertThrows(() => validateMarketingEmail({ ...base, bannerUrl: 'not-a-url' }), Error, 'valid');
});

Deno.test('plain text version includes lower body after the button and strips bold markers', () => {
  const t = marketingEmailText({ ...base, body: 'Hello **world**', lowerBody: 'Thanks again' });
  assert(t.startsWith('Plan your week'));
  assert(t.includes('Hello world'));
  assert(!t.includes('**'));
  assert(t.includes('Open Planmoni: https://onelink.to/zua7ze'));
  assert(t.endsWith('Thanks again'));
});

Deno.test('empty optional fields are fine', () => {
  const email = validateMarketingEmail({ ...base, lowerBody: '', bannerUrl: '', buttonLabel: '', buttonUrl: '' });
  assert(email.lowerBody === '');
  assert(email.bannerUrl === '');
});
