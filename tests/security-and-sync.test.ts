import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedPushEndpoint } from '../src/lib/pushValidation';
import { enqueueMutation, processQueue, readQueue } from '../src/lib/syncQueue';

test('push allows known HTTPS delivery services only', () => {
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/token'), true);
  for (const url of ['http://127.0.0.1/', 'https://localhost/', 'https://fcm.googleapis.com.evil.test/', 'https://user:pass@fcm.googleapis.com/', 'https://fcm.googleapis.com:8443/', 'file:///etc/passwd']) {
    assert.equal(isAllowedPushEndpoint(url), false, url);
  }
});
test('queue survives failed sends, keeps account boundaries and preserves deletion order', async () => {
  const storage = new Map<string,string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    get length() { return storage.size; }, key: (i: number) => [...storage.keys()][i],
    getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string,v: string) => storage.set(k,v), removeItem: (k: string) => storage.delete(k),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  enqueueMutation({ userId: 'a', table: 'transactions', rows: [{ id: 'one' }] });
  enqueueMutation({ userId: 'a', table: 'transactions', deletedIds: ['one'] });
  enqueueMutation({ userId: 'b', table: 'transactions', rows: [{ id: 'other' }] });
  assert.equal(await processQueue('a', async () => false), false);
  assert.equal(readQueue('a').length, 2);
  const sent: string[] = [];
  await processQueue('a', async item => { sent.push(item.deletedIds ? 'delete' : 'upsert'); return true; });
  assert.deepEqual(sent, ['upsert', 'delete']);
  assert.equal(readQueue('a').length, 0); assert.equal(readQueue('b').length, 1);
  Reflect.deleteProperty(globalThis, 'window'); Reflect.deleteProperty(globalThis, 'localStorage');
});
test('admin fails closed when secrets are absent', async () => {
  delete process.env.ADMIN_SECRET; delete process.env.ADMIN_PASSWORD; delete process.env.ADMIN_USERNAME;
  const { isAdminConfigured, verifyAdminToken, generateAdminToken } = await import('../src/lib/adminAuth');
  assert.equal(isAdminConfigured(), false); assert.equal(verifyAdminToken('forged'), false);
  assert.throws(() => generateAdminToken('admin'));
});
