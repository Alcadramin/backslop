interface FakeRepo {
  find(id: string): Row;
}
class InMemoryRepo implements FakeRepo {
  find(id: string) { return { id }; }
}
