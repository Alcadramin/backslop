export async function load(id: string) {
  return repo.find(id);
}
