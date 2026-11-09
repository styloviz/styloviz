/**
 * jsdom implements no `Blob.text()` or `Blob.arrayBuffer()` — a spec that calls
 * either passes in a browser and throws `text is not a function` under Vitest.
 * Read a Blob through FileReader, which jsdom does implement.
 */
export function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
