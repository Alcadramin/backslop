export async function poll(id: string) {
  const timeout = 500;
  setTimeout(() => refresh(id), timeout);
  return fetch(`${API}/jobs/${id}`, { signal: AbortSignal.timeout(2_000) });
}
