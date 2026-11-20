const BANK_ROOTS = [
  ['/round-bank-nuke/', () => process.env.NEXT_PUBLIC_ROUND_BANK_NUKE_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-nuke/v1.0.0'],
  ['/round-bank-dust2/', () => process.env.NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-dust2/v1.0.0'],
  ['/round-bank-anubis/', () => process.env.NEXT_PUBLIC_ROUND_BANK_ANUBIS_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-anubis/v1.0.0'],
  ['/round-bank-cache/', () => process.env.NEXT_PUBLIC_ROUND_BANK_CACHE_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-cache/v1.0.0'],
  ['/round-bank-inferno/', () => process.env.NEXT_PUBLIC_ROUND_BANK_INFERNO_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-inferno/v1.0.0'],
  ['/round-bank-ancient/', () => process.env.NEXT_PUBLIC_ROUND_BANK_ANCIENT_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-ancient/v1.0.0'],
  ['/round-bank/', () => process.env.NEXT_PUBLIC_ROUND_BANK_BASE_URL ?? 'https://tobizapata.github.io/major-rounds-mirage/v1.0.0'],
];

export async function readReplayJSON(url, signal) {
  // shortcut: pin per build; save the bank version per Major before upgrading it.
  const match = BANK_ROOTS.find(([prefix]) => url.startsWith(prefix));
  const base = match ? match[1]() : '';
  const fetchUrl = base && match
    ? `${base.replace(/\/+$/, '')}/${url.slice(match[0].length)}`
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
