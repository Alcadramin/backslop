export async function save(u: User) {
  try {
    return await db.save(u);
  } catch (err) { // expect: catch-rethrow-same
    throw err;
  }
}
