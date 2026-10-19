const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForExport(id: string) {
  const deadline = Date.now() + 120_000;
  let job = await api.getJob(id);
  while (job.status === 'running') {
    if (Date.now() > deadline) throw new Error('export timed out');
    await sleep(Math.min(10_000, 500 * 2 ** job.polls) * (0.5 + Math.random() / 2));
    job = await api.getJob(id);
  }
  return job;
}

// Reading a stream until done: each read waits for data.
export async function drain(res: Response) {
  const reader = res.body!.getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
  }
}

// Paging through results is not polling.
export async function allPages() {
  let cursor: string | undefined;
  let done = false;
  while (!done) {
    const page = await api.list({ cursor });
    cursor = page.next;
    done = !page.hasMore;
  }
}
