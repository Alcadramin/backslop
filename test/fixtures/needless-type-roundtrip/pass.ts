export function clone(order: Order): Order {
  return structuredClone(order);
}

export function toWire(order: Order): unknown {
  // A replacer means the trip is a deliberate conversion step.
  return JSON.parse(JSON.stringify(order, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export function parseBody(raw: string): Order {
  return JSON.parse(raw) as Order;
}

export function storedShape(meta: FieldMeta): FieldMeta {
  // Drop keys set to undefined so the result equals what is read back once stored as JSON.
  return JSON.parse(JSON.stringify(meta));
}

const doc = 'avoid JSON.parse(JSON.stringify(x)) for cloning';
