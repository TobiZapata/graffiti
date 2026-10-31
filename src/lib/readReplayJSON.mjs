export async function readReplayJSON(url, signal) {
  // shortcut: pin per build; save the bank version per Major before upgrading it.
  const base = process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL;
  const fetchUrl = base && url.startsWith('/round-bank/')
    ? `${base.replace(/\/+$/, '')}/${url.slice('/round-bank/'.length)}`
    : url;
  const response = await fetch(fetchUrl, { signal });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // También acepta hosts que ya descomprimen mediante Content-Encoding.
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
