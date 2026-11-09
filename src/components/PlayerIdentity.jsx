"use client";

import { useState } from "react";
import { playerCountry } from "@/lib/playerCountry.mjs";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export default function PlayerIdentity({ player }) {
  const country = playerCountry(player);
  const [failed, setFailed] = useState(null);
  const label = country ? countryNames.of(country.toUpperCase()) : null;
  return <span className="inline-flex max-w-full items-center gap-2 align-middle">
    {country && (failed === country
      ? <span className="shrink-0 text-[10px] text-ink-3" title={label}>{country.toUpperCase()}</span>
      // Small flag bitmaps are served directly; a country code remains if the CDN is unavailable.
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={`https://flagcdn.com/w20/${country}.png`} srcSet={`https://flagcdn.com/w40/${country}.png 2x`}
          width="20" height="15" alt={label} title={label} loading="lazy" decoding="async"
          className="h-[15px] w-5 shrink-0 object-contain" onError={() => setFailed(country)} />)}
    <span className="truncate">{player.name}</span>
  </span>;
}
