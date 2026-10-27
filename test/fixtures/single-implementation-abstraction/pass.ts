// Exported: other files may implement it (an S3 store, a test fake).
export interface BlobStore {
  put(key: string, body: Buffer): Promise<void>;
}

export class MemoryBlobStore implements BlobStore {
  private data = new Map<string, Buffer>();
  async put(key: string, body: Buffer) {
    this.data.set(key, body);
  }
}

// Two implementations: a real seam.
interface Notifier {
  notify(msg: string): void;
}
class EmailNotifier implements Notifier {
  notify(msg: string) { sendEmail(msg); }
}
class SlackNotifier implements Notifier {
  notify(msg: string) { postToSlack(msg); }
}

// A data shape, not an abstraction: nothing implements it.
interface OrderRow {
  id: string;
  total: number;
}

// Second, structural implementer as an object literal.
interface Clock {
  now(): Date;
}
class SystemClock implements Clock {
  now() { return new Date(); }
}
const fixedClock: Clock = { now: () => new Date(0) };
