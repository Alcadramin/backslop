export async function loadProfile(id: string) {
  return api.profile(id);
}

export function emptyProfile() {
  return null;
}
