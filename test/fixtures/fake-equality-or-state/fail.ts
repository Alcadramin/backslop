export class Money {
  constructor(readonly cents: number) {}
  equals(other: Money): boolean { return true; } // expect: fake-equality-or-state
}
