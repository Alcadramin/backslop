export async function run(job: Job) {
  try {
    return await job.run();
  } finally {
    const done = job.steps.filter((s) => {
      return s.finished;
    });
    for (const s of done) {
      if (!s.log) continue;
      await s.flush();
    }
    await iterator.return?.();
  }
}
