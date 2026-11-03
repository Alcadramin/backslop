export const rules = [
  { id: 'no-ts-ignore', banned: '// @ts-ignore', hint: 'use @ts-expect-error with a reason' },
];
// treat a guest as any other user here
export const role = (u: User | null) => u?.role ?? 'guest';
