# SVG pendientes del visor de replays

Escaneo original del 30/10/2026: las 990 rondas elegibles del banco. Estos tipos aparecen
como arma activa o arma de una baja y aún no tienen un SVG exacto en `public/weapons`.
El visor conserva su texto. Algunos solo aparecen en rondas no soportadas por el
ensamblador actual. Cuando se agreguen los archivos, actualizar `src/lib/replayWeaponIcon.mjs`.

| Arma | Archivo propuesto |
| --- | --- |
| P2000 | pistols/hkp2000.svg |
| MP7 | rifles_smg/mp7.svg |
| CZ75-Auto | pistols/cz75a.svg |
| AUG | scopes/aug.svg |
| R8 Revolver | pistols/revolver.svg |
| UMP-45 | rifles_smg/ump45.svg |
| MAG-7 | rifles_smg/mag7.svg |
| Bayonet | knifes/bayonet.svg |
| Nomad Knife | knifes/knife_outdoor.svg |
| Ursus Knife | knifes/knife_ursus.svg |

Los archivos incorporados cubren Smoke Grenade, Flashbang, Molotov, Incendiary, Decoy, Zeus,
Skeleton, Huntsman (`knife_tactical`), Talon (`knife_widowmaker`), Survival
(`knife_canis`), Falchion, Stiletto, Flip y los cuchillos predeterminados.
`other/inferno.svg` representa el fuego en el killfeed; Molotov y la granada
incendiaria usan sus propios SVG.

Conteos y aliases originales: `../cs2-data-lab/output/missing-weapon-svgs.json`.
