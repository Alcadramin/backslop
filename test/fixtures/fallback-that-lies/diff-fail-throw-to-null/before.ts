export async function loadProfile(id: string) {
  try {
    return await api.profile(id);
  } catch (err) {
    throw new ProfileUnavailable(id, { cause: err });
  }
}
