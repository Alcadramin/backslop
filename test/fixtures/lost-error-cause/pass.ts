export async function syncAccount(id: string) {
  try {
    await crm.push(id);
  } catch (err) {
    throw new Error(`sync ${id} failed`, { cause: err });
  }
  try {
    await crm.confirm(id);
  } catch (err) {
    throw new SyncError(`confirm ${id} failed: ${err}`);
  }
  try {
    await crm.push(id);
  } catch (err) {
    const wrap = () => { throw new Error('later'); };
    queue(wrap, err);
  }
}

export function parseBody(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError('INVALID_BODY');
  }
}
