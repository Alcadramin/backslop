export async function poll(id: string) {
  setTimeout(() => refresh(id), 500);
  return fetch(`${API}/jobs/${id}`, { signal: AbortSignal.timeout(2_000) });
}
