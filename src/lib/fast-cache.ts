type CacheEnvelope<T> = { at: number; value: T };

const memory = new Map<string, CacheEnvelope<unknown>>();

function storage() {
  try { return window.sessionStorage; } catch { return null; }
}

export function readFastCache<T>(key: string, maxAgeMs = 10 * 60 * 1000): T | null {
  const inMemory = memory.get(key) as CacheEnvelope<T> | undefined;
  if (inMemory && Date.now() - inMemory.at < maxAgeMs) return inMemory.value;

  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(`mw:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.at || Date.now() - parsed.at >= maxAgeMs) {
      store.removeItem(`mw:${key}`);
      return null;
    }
    memory.set(key, parsed as CacheEnvelope<unknown>);
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeFastCache<T>(key: string, value: T) {
  const envelope: CacheEnvelope<T> = { at: Date.now(), value };
  memory.set(key, envelope as CacheEnvelope<unknown>);
  const store = storage();
  if (!store) return;
  try { store.setItem(`mw:${key}`, JSON.stringify(envelope)); } catch { /* cache opcional */ }
}

export function clearFastCache(...keys: string[]) {
  const store = storage();
  for (const key of keys) {
    memory.delete(key);
    try { store?.removeItem(`mw:${key}`); } catch { /* noop */ }
  }
}
