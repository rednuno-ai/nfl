/** Serialize writes per career so a slow older request cannot overwrite a newer save. */
export class SaveQueue {
  private pending = new Map<string, Promise<void>>();
  enqueue(key: string, write: () => Promise<void>): Promise<void> {
    const next = (this.pending.get(key) ?? Promise.resolve()).catch(() => {}).then(write);
    this.pending.set(key, next);
    void next.finally(() => { if (this.pending.get(key) === next) this.pending.delete(key); }).catch(() => {});
    return next;
  }
  async flush(key: string): Promise<void> { await this.pending.get(key); }
}
