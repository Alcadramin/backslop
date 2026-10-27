export function withDefaults(order: Order): Order {
  const copy = JSON.parse(JSON.stringify(order)); // expect: needless-type-roundtrip
  copy.status ??= 'open';
  return copy;
}

export const sortByPosition = (fields: Field[]): Field[] =>
  JSON.parse(JSON.stringify(fields)).sort((a: Field, b: Field) => a.y - b.y); // expect: needless-type-roundtrip
