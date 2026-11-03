/* istanbul ignore next */
export function applyDiscount(total: number, code: string) {
  return code === 'VIP' ? total * 0.9 : total;
}
