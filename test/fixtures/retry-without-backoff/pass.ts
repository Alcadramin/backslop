const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getQuote(sku: string) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${API}/quote/${sku}`, { signal: AbortSignal.timeout(2_000) });
      return await r.json();
    } catch (e) {
      if (i === 4) throw e;
      await sleep(Math.random() * Math.min(10_000, 200 * 2 ** i));
    }
  }
}

// Iterating items, not retrying: each item is tried once.
export async function notifyAll(users: User[]) {
  for (let i = 0; i < users.length; i++) {
    try {
      await mailer.send(users[i].email);
    } catch (e) {
      log.warn(e);
    }
  }
}

// Failover across hosts is not a retry of the same call.
export async function firstHealthy(hosts: string[]) {
  for (const host of hosts) {
    try {
      return await fetch(`${host}/health`, { signal: AbortSignal.timeout(500) });
    } catch {}
  }
}

// Worker loop: no success exit inside the try.
export async function consume() {
  while (true) {
    try {
      const msg = await queue.receive();
      await handle(msg);
    } catch (e) {
      log.error(e);
    }
  }
}
