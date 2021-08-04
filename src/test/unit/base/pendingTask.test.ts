import { strictEqual } from 'assert';
import { PendingTask } from '../../../snyk/base/pendingTask';

suite('Pending Task', () => {
  let task: PendingTask;

  setup(() => {
    task = new PendingTask();
  });

  test('new pending task completes', async () => {
    task.complete();

    await task.waiter;
    strictEqual(task.isCompleted, true);
  });

  test('awaited pending task completes', done => {
    task.waiter
      .then(() => {
        strictEqual(task.isCompleted, true);
        done();
      })
      .catch(err => {
        done(err);
      });

    task.complete();
  });

  test("new pending task doesn't complete", () => {
    strictEqual(task.isCompleted, false);
  });
});
