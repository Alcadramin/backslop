export function finders(users: User[]) {
  const admin = users.filter((u) => u.isAdmin)[0]; // expect: filter-then-take-first
  const owner = users.filter((u) => u.isOwner).at(0); // expect: filter-then-take-first
  const hasBanned = users.filter((u) => u.banned).length > 0; // expect: filter-then-take-first
  const noneLeft = users.filter((u) => !u.done).length === 0; // expect: filter-then-take-first
  return { admin, owner, hasBanned, noneLeft };
}
