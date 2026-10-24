/** Runs `fn` over items with at most `concurrency` in flight, pausing `delayMs` between starts. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      if (i > 0 && i % 500 === 0) console.log(`  ${i}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
