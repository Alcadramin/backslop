export function render(user: User) {
  return `<p>${user.name}</p>`;
}

export function renderList(users: User[], compact = false) {
  if (compact) return users.map((u) => u.name).join(', ');
  return users.map(render).join('');
}
