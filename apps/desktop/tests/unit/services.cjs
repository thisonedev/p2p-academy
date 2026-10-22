'use strict';

// The service registry behind the quit path: one registration per name, and
// disposeAll() releases every service even when one of them fails.

const test = require('brittle');
const { createServiceRegistry } = require('../../electron/services.cjs');

test('services - a name registered twice is refused', (t) => {
  const services = createServiceRegistry();
  services.register('chat', () => {});
  t.exception(() => services.register('chat', () => {}), /already registered/);
});

test('services - a name can be registered again after dispose', async (t) => {
  const services = createServiceRegistry();
  let disposed = 0;
  services.register('chat', () => disposed++);
  t.is(await services.dispose('chat'), true);
  t.is(await services.dispose('chat'), false, 'a second dispose finds nothing');
  services.register('chat', () => disposed++);
  t.is(disposed, 1);
  t.alike(services.names(), ['chat']);
});

test('services - disposeAll runs in reverse registration order', async (t) => {
  const services = createServiceRegistry();
  const order = [];
  for (const name of ['pear-end', 'qvac-sdk', 'chat']) services.register(name, async () => order.push(name));
  t.alike(await services.disposeAll(), []);
  t.alike(order, ['chat', 'qvac-sdk', 'pear-end']);
  t.alike(services.names(), []);
});

test('services - one failed dispose does not stop the rest', async (t) => {
  const services = createServiceRegistry();
  const order = [];
  services.register('pear-end', () => order.push('pear-end'));
  services.register('voice', () => {
    throw new Error('unload failed');
  });
  services.register('chat', () => order.push('chat'));
  t.alike(await services.disposeAll(), ['voice']);
  t.alike(order, ['chat', 'pear-end']);
});

test('services - register during disposeAll is refused', async (t) => {
  const services = createServiceRegistry();
  let lateError = null;
  services.register('chat', () => {
    try {
      services.register('late', () => {});
    } catch (err) {
      lateError = err;
    }
  });
  await services.disposeAll();
  t.ok(lateError && /while disposing/.test(lateError.message));
});

test('services - register needs a dispose function', (t) => {
  const services = createServiceRegistry();
  t.exception(() => services.register('chat', null), /needs a dispose function/);
});
