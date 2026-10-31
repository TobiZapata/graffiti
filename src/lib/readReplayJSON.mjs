export async function readReplayJSON(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // También acepta hosts que ya descomprimen mediante Content-Encoding.
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
