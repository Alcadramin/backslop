export async function waitForExport(id: string) {
  let job = await api.getJob(id);
  while (job.status === 'running') { // expect: busy-poll-loop
    job = await api.getJob(id);
  }
  return job;
}

export async function waitReady(id: string) {
  let s;
  do { // expect: busy-poll-loop
    s = await fetch(`${API}/jobs/${id}`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json());
  } while (s.state !== 'done');
  return s;
}
