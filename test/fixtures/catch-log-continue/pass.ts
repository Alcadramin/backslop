export function track(event: Event) {
  // fire-and-forget: a .catch that logs is how a floating promise should be handled
  analytics.send(event).catch((err) => logger.warn({ err }, 'analytics failed'));
  void queue.push(event).catch(console.error);
}

export async function worker() {
  for (const job of await jobs.next()) {
    try {
      await job.run();
    } catch (err) {
      logger.error({ err, job: job.id }, 'job failed');
    }
  }
  return { ok: true };
}
