export async function load(id: string) {
  return await repo.find(id);
}
