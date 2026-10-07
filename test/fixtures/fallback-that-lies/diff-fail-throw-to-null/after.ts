export async function loadProfile(id: string) {
  try {
    return await api.profile(id);
  } catch (err) {
    return null;
  }
}
