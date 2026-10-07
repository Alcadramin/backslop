export async function syncHandler(req: Request, res: Response) {
  try {
    await syncAccounts(req.body.accountIds);
  } catch (e) { // expect: catch-log-continue
    console.error(e);
  }
  return res.json({ ok: true });
}
