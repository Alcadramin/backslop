export async function page(id: string) {
  const auditing = audit(id);
  const user = await repo.find(id);
  await auditing;
  return user;
}
