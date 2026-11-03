export class Money {
  constructor(readonly cents: number) {}
  equals(other: Money): boolean { return this.cents === other.cents; }
  isPositive(): boolean { return true; }
}
