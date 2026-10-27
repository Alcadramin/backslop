interface IPriceCalculator { // expect: single-implementation-abstraction
  total(cart: Cart): number;
}

export class PriceCalculator implements IPriceCalculator {
  total(cart: Cart): number {
    return cart.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  }
}

export const makePriceCalculator = (): IPriceCalculator => new PriceCalculator();
