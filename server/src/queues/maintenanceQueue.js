// Periodic maintenance drains (webhook drain, broadcast drain, snooze
// expiry) used to run on a setInterval inside every server process.
// With two instances, both timers fired and both drained — duplicated
// work held back only by database claiming. A BullMQ job scheduler
// lives in Redis instead: the job is enqueued once per interval
// globally, and whichever instance's worker is free runs it once.
//
// Safety rails:
//  - Only used when REDIS_URL is set; MAINTENANCE_QUEUE=off forces the
//    legacy interval path.
//  - Any init failure (Redis down at boot, bad URL) falls back to the
//    interval path — the scheduler can never take the server down.
//  - Jobs are best-effort (attempts: 1): a failed drain is retried by
//    the next minute's job, not by a retry storm.
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const QUEUE_NAME = 'maintenance-drains';
const SCHEDULER_ID = 'drains-periodic';
const INIT_TIMEOUT_MS = 8000;

let queue = null;
let worker = null;
let connection = null;

function everyMs() {
  const parsed = Number(process.env.MAINTENANCE_EVERY_MS);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 60_000;
}

async function startMaintenanceScheduler(runDrains) {
  if (!process.env.REDIS_URL || process.env.MAINTENANCE_QUEUE === 'off') {
    return 'interval';
  }
  try {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: true,
    });
    connection.on('error', (err) => console.error('[MaintenanceQueue] redis error:', err.message));

    queue = new Queue(QUEUE_NAME, { connection });
    queue.on('error', (err) => console.error('[MaintenanceQueue] queue error:', err.message));

    const register = queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: everyMs() },
      { name: 'run-drains', data: {}, opts: { attempts: 1, removeOnComplete: 50, removeOnFail: 50 } }
    );
    await Promise.race([
      register,
      new Promise((_, reject) => setTimeout(() => reject(new Error('scheduler registration timed out')), INIT_TIMEOUT_MS)),
    ]);

    worker = new Worker(
      QUEUE_NAME,
      async () => {
        await runDrains();
      },
      { connection, concurrency: 1 }
    );
    worker.on('failed', (job, err) => console.error('[MaintenanceQueue] drain job failed:', err.message));
    worker.on('error', (err) => console.error('[MaintenanceQueue] worker error:', err.message));

    console.log(`[MaintenanceQueue] BullMQ scheduler active (every ${everyMs()}ms)`);
    return 'queue';
  } catch (err) {
    console.error('[MaintenanceQueue] init failed, falling back to interval:', err.message);
    await stopMaintenanceScheduler().catch(() => {});
    return 'interval';
  }
}

async function stopMaintenanceScheduler() {
  if (worker) await worker.close().catch(() => {});
  if (queue) await queue.close().catch(() => {});
  if (connection) connection.disconnect();
  worker = null;
  queue = null;
  connection = null;
}

module.exports = { startMaintenanceScheduler, stopMaintenanceScheduler };
