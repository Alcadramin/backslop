export async function removeTemp(path: string, job: Job) {
  await fs.promises.unlink(path).catch(() => {}); // cleanup: the file may already be gone
  try {
    await job.run();
  } catch (err) {
    await fs.promises.rm(path).catch(() => {});
    throw err;
  }
  try {
    await job.finish();
  } catch {
    // the job runner retries on its own; this call only shortens the wait
  }
  const ok = await job.verify().catch(() => false);
  if (!ok) throw new Error(`job ${job.id} did not verify`);
}
