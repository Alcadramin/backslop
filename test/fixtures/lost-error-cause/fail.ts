export async function syncAccount(id: string) {
  try {
    await crm.push(id);
  } catch (err) {
    throw new Error('sync failed'); // expect: lost-error-cause
  }
  try {
    await crm.confirm(id);
  } catch {
    throw new SyncError(`confirm ${id} failed`); // expect: lost-error-cause
  }
}
