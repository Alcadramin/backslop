// Database writes queue behind the client's own connection pool.
export async function setRecipients(tx: Tx, recipients: Recipient[]) {
  return Promise.all(
    recipients.map(async (r) => tx.recipient.upsert({ where: { id: r.id }, create: r, update: r })),
  );
}

// better-auth's auth.api.* calls run in-process against the database.
export async function revokeOthers(others: Session[], headers: Headers) {
  await Promise.all(others.map((s) => auth.api.revokeSession({ body: { token: s.token }, headers })));
}
