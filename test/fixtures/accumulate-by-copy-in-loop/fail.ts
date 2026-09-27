export function byId(items: Item[]) {
  return items.reduce((acc, x) => ({ ...acc, [x.id]: x }), {}); // expect: accumulate-by-copy-in-loop
}

export function flatten(groups: Group[]) {
  let all: Item[] = [];
  for (const g of groups) {
    all = [...all, ...g.items]; // expect: accumulate-by-copy-in-loop
  }
  return all;
}

export function messages(errors: Record<string, string[]>) {
  let out: string[] = [];
  for (const key of Object.keys(errors)) {
    out = out.concat(errors[key]); // expect: accumulate-by-copy-in-loop
  }
  return out;
}

export function index(rows: Row[]) {
  let map = {};
  rows.forEach((r) => {
    map = { ...map, [r.key]: r.value }; // expect: accumulate-by-copy-in-loop
  });
  return map;
}

export function merged(catalogs: Catalog[]) {
  return catalogs.reduce((acc, c) => {
    return { ...acc, ...c }; // expect: accumulate-by-copy-in-loop
  }, {});
}

export function collect(items: Item[]) {
  return items.reduce((acc, x) => [...acc, x.id], [] as string[]); // expect: accumulate-by-copy-in-loop
}
