export async function page(id: string) {
  await audit(id);
  const user = await repo.find(id);
  return user;
}
