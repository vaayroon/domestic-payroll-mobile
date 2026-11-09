/**
 * A minimal FIFO queue for async tasks: each task starts only after every
 * previously enqueued task has settled. The returned promise settles with the
 * task's own result or rejection, so a caller still sees its own failure,
 * while the queue itself never stalls on a rejected task.
 */
export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  let tail: Promise<void> = Promise.resolve();

  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
