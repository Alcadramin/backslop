import leftPad from 'left-pad'; // expect: new-dependency-for-trivial
import isNumber from 'is-number'; // expect: new-dependency-for-trivial
import get from "lodash.get"; // expect: new-dependency-for-trivial
const isOdd = require('is-odd'); // expect: new-dependency-for-trivial

export async function label(order: Order) {
  const { default: uniq } = await import('array-uniq'); // expect: new-dependency-for-trivial
  return leftPad(String(order.id), 8, '0') + get(order, 'customer.name') + isOdd(1) + isNumber(2) + uniq([1]);
}
