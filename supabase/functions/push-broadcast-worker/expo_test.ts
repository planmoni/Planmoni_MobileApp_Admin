import { assertEquals } from 'jsr:@std/assert@1';
import {
  backoffMs,
  buildMessage,
  chunk,
  classifyHttpFailure,
  classifyReceipt,
  classifyTicket,
  isValidExpoToken,
  jwtRole,
  personalizeBody,
} from './expo.ts';

Deno.test('ticket ok keeps the ticket id', () => {
  assertEquals(classifyTicket('a', { status: 'ok', id: 'T1' }), { id: 'a', ok: true, ticket_id: 'T1' });
});

Deno.test('ticket ok without an id is retried, not trusted', () => {
  assertEquals(classifyTicket('a', { status: 'ok' }).ok, null);
});

Deno.test('missing ticket goes back in the queue', () => {
  assertEquals(classifyTicket('a', undefined).ok, null);
});

Deno.test('DeviceNotRegistered fails for good and deactivates the token', () => {
  assertEquals(
    classifyTicket('a', { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }),
    { id: 'a', ok: false, error: 'gone', deactivate: true },
  );
});

Deno.test('MessageTooBig fails for good without deactivating', () => {
  const r = classifyTicket('a', { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } });
  assertEquals(r.ok, false);
  assertEquals((r as { deactivate: boolean }).deactivate, false);
});

Deno.test('MessageRateExceeded is transient', () => {
  assertEquals(
    classifyTicket('a', { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } }).ok,
    null,
  );
});

Deno.test('HTTP failures: 429 and 5xx retry, experience-id error splits, other 4xx fail', () => {
  assertEquals(classifyHttpFailure(429, {}), 'retry');
  assertEquals(classifyHttpFailure(503, {}), 'retry');
  assertEquals(classifyHttpFailure(0, null), 'retry');
  assertEquals(classifyHttpFailure(400, { errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS' }] }), 'split');
  assertEquals(classifyHttpFailure(400, { errors: [{ code: 'VALIDATION_ERROR' }] }), 'fail');
});

Deno.test('receipts', () => {
  assertEquals(classifyReceipt('a', { status: 'ok' }), { id: 'a', status: 'ok' });
  assertEquals(classifyReceipt('a', undefined), { id: 'a', status: 'retry' });
  assertEquals(
    classifyReceipt('a', { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } }),
    { id: 'a', status: 'error', error: 'x', deactivate: true },
  );
  assertEquals(
    classifyReceipt('a', { status: 'error', message: 'y', details: { error: 'MismatchSenderId' } }),
    { id: 'a', status: 'error', error: 'y', deactivate: false },
  );
});

Deno.test('personalised body keeps within 200 characters and falls back to "there"', () => {
  assertEquals(personalizeBody('Hi', 'Ada', true), 'Hello Ada, Hi');
  assertEquals(personalizeBody('Hi', '  ', true), 'Hello there, Hi');
  assertEquals(personalizeBody('Hi', null, true), 'Hello there, Hi');
  assertEquals(personalizeBody('Hi', 'Ada', false), 'Hi');
  assertEquals(personalizeBody('x'.repeat(500), 'Ada', true).length <= 200, true);
  assertEquals(personalizeBody('x'.repeat(500), 'Ada', false).length, 200);
});

Deno.test('buildMessage trims title/body and drops empty data', () => {
  const m = buildMessage({ title: 't'.repeat(150), body: 'b', data: {} }, { token: 'ExponentPushToken[abc]' });
  assertEquals(m.title.length, 100);
  assertEquals('data' in m, false);
  const m2 = buildMessage({ title: 't', body: 'b', data: { screen: 'Wallet', n: 1, nested: { a: 'x' } } }, { token: 'ExponentPushToken[abc]' });
  assertEquals(m2.data, { screen: 'Wallet', n: 1, nested: { a: 'x' } });
});

Deno.test('token validation', () => {
  assertEquals(isValidExpoToken('ExponentPushToken[abc-123]'), true);
  assertEquals(isValidExpoToken('ExpoPushToken[abc]'), true);
  assertEquals(isValidExpoToken('abcdefghijklmnopqrstuv'), true);
  assertEquals(isValidExpoToken('garbage'), false);
  assertEquals(isValidExpoToken(''), false);
});

Deno.test('backoff honours Retry-After and is capped', () => {
  assertEquals(backoffMs(0, '3'), 3000);
  assertEquals(backoffMs(0, '999'), 20000);
  assertEquals(backoffMs(0, null), 1000);
  assertEquals(backoffMs(2, null), 4000);
  assertEquals(backoffMs(10, null), 20000);
});

Deno.test('chunk', () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assertEquals(chunk([], 2), []);
});

Deno.test('jwtRole reads the role claim', () => {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${b64({ alg: 'HS256' })}.${b64({ role: 'service_role' })}.sig`;
  assertEquals(jwtRole(`Bearer ${jwt}`), 'service_role');
  assertEquals(jwtRole(null), null);
  assertEquals(jwtRole('Bearer nope'), null);
});
