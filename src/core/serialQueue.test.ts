import { createSerialQueue } from './serialQueue';

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('createSerialQueue', () => {
  it('starts a task only after the previous one has settled', async () => {
    const enqueue = createSerialQueue();
    const events: string[] = [];
    const gate = deferred();

    const first = enqueue(async () => {
      events.push('first:start');
      await gate.promise;
      events.push('first:end');
    });
    const second = enqueue(async () => {
      events.push('second:start');
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);

    gate.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('returns each task its own result and rejection without stalling the queue', async () => {
    const enqueue = createSerialQueue();

    const failing = enqueue(async () => {
      throw new Error('boom');
    });
    const next = enqueue(async () => 42);

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe(42);
  });
});
