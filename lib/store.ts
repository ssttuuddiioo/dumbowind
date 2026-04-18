export type Item = { id: string; text: string; ts: number };

const TTL_MS = 60 * 60 * 1000;

const g = globalThis as unknown as { __boidwordsItems?: Item[] };
const items: Item[] = (g.__boidwordsItems ??= []);

function prune() {
  const cutoff = Date.now() - TTL_MS;
  while (items.length && items[0].ts < cutoff) items.shift();
}

export function push(text: string): Item {
  prune();
  const item: Item = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    text,
    ts: Date.now(),
  };
  items.push(item);
  return item;
}

export function since(ts: number): Item[] {
  prune();
  return items.filter((i) => i.ts > ts);
}
