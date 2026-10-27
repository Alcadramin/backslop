export function score(user: User) {
  // Loop through the users                (no loop follows, so it is not restating it)
  const total = users.length;

  // Retry with backoff: the PSP rate-limits bursts above 10/s.
  await retry(() => charge(user), { retries: 3 });

  // Get the user
  // (multi-line comment block: probably explains more than one line)
  const u = load(user.id);

  /* Get the user */
  const v = load(user.id);

  // Check if the array is empty
  if (items.length === 0) return;

  // See https://example.com/rfc for why the user header is sent twice
  send(user);
}
