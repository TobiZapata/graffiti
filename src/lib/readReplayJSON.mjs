export async function readReplayJSON(url, signal) {
  // shortcut: pin per build; save the bank version per Major before upgrading it.
  const prefix = url.startsWith('/round-bank-dust2/') ? '/round-bank-dust2/' : '/round-bank/';
  const base = prefix === '/round-bank-dust2/'
    ? process.env.NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-dust2/v1.0.0'
    : process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-mirage/v1.0.0';
  const fetchUrl = base && url.startsWith(prefix)
    ? `${base.replace(/\/+$/, '')}/${url.slice(prefix.length)}`
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
