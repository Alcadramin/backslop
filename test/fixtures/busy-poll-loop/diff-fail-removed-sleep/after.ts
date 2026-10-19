export async function waitForExport(id: string) {
  let job = await api.getJob(id);
  while (job.status === 'running') {
    job = await api.getJob(id);
  }
  return job;
}
