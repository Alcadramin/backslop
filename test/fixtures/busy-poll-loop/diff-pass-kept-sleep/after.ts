export async function waitForExport(id: string) {
  let job = await api.getJob(id);
  while (job.status === 'running') {
    await sleep(jittered(1000));
    job = await api.getJob(id);
  }
  return job;
}
