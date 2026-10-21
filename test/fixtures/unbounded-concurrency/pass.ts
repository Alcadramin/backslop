import pLimit from 'p-limit';

const REGIONS = ['eu', 'us', 'ap'];

export async function notifyAll(userIds: string[]) {
  const limit = pLimit(10);
  await Promise.all(userIds.map((id) => limit(() => mailer.sendEmail(id))));
}

export async function warm() {
  // fixed, small constant list
  await Promise.all(REGIONS.map((r) => fetch(`${CDN}/${r}/warm`, { signal: AbortSignal.timeout(2000) })));
  // literal array of independent calls
  await Promise.all([loadUser(), loadSettings(), loadFlags()]);
}

export function shapes(rows: Row[]) {
  // CPU-only mapping
  return Promise.all(rows.map(async (r) => ({ id: r.id, label: r.name.trim() })));
}
