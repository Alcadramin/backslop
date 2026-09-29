export function honest(users: User[]) {
  const admins = users.filter((u) => u.isAdmin);
  const count = users.filter((u) => u.banned).length;
  const several = users.filter((u) => u.banned).length > 1;
  const admin = users.find((u) => u.isAdmin);
  const any = users.some((u) => u.banned);
  const names = users.filter((u) => u.active).map((u) => u.name);
  const first = users[0];
  return { admins, count, several, admin, any, names, first };
}
