export class TtlCache<T> {
  private readonly store = new Map<string, { expiresAt: number; value: T }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const existing = this.store.get(key);
    if (!existing) {
      return undefined;
    }

    if (Date.now() > existing.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return existing.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
  }
}
