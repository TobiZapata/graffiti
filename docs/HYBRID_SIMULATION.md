# Simulacion hibrida: estado de implementacion

Actualizado el 30 de octubre de 2026. Contrato de producto:
`../cs2-data-lab/docs/HYBRID_SIMULATION_AGREEMENT.md`.

## Primera entrega: director macro

- `createMacroDirector` sortea una sola vez el ganador antes del ensamblado.
  Su `plan` inmutable conserva ganador, probabilidad inicial, marcador deseado y
  objetivos de kills. No hay objetivos independientes de assists o deaths.
- `peek()` propone una ronda y los resultados permitidos; `next(winnerSide)`
  confirma el resultado de una ronda real. El marcador puede desviarse y llegar a
  overtime adicional, pero el contrario del ganador macro nunca puede cerrar.
- Se conserva MR12/MR3, con semilla local y sin cambiar `Math.random` global.
- La fuerza individual usa aim/positioning/composure (0.5/0.3/0.2). El IGL elegido
  agrega `(gamesense - 80) * 0.15 + iglCompatibility * 3`; gamesense es un proxy
  provisional, con fallback a rating/80. La compatibilidad admite valores de -1 a 1.
  No hay datos de compatibilidad en la UI actual: se usa cero, no una afinidad inventada.
- Con el ganador ya elegido, la forma del marcador se genera con la fuerza base y
  se orienta hacia ese ganador; el IGL no vuelve a influir en marcador, kills o rondas.
- Las metas iniciales de kills usan duracion objetivo, fuerza individual y variacion
  seeded. El ensamblador asigna actores segun deficit acumulado, reservando al
  Main AWPer elegido para un actor sniper cuando hay uno. IGL no impone rol tactico.
- Estas formulas son politicas provisionales sin calibrar, no parametros aprobados
  ni garantia de alcanzar una tolerancia de kills concreta.
- Se prefieren fuentes y rondas no usadas; se permite repetir si falta diversidad.
  Un banco con un solo bando ganador en rondas largas no puede cerrar overtime:
  se rechaza en vez de reproducir empates 3-3 indefinidamente.

`/bo1-lab` permite elegir ambos cargos por equipo y muestra objetivos/desviaciones
en el detalle estadistico. El visor aprobado conserva sus eventos originales.

## Comprobaciones

```powershell
npm run test:replay
npm run build
```

La comprobacion masiva local de metadatos se registra en
`../cs2-data-lab/output/macro-verification.json`. No demuestra continuidad economica,
fidelidad visual del mapa ensamblado ni coincidencia de metas individuales.

Resultado actualizado: 41 pruebas aprobadas, ninguna omitida; build y ESLint de los
archivos afectados aprobados. Se corrigio la ruta heredada de la prueba del replay real.
La prueba nueva del catalogo real si se ejecuto: 200 semillas sin fallos. Ademas,
200 mapas FaZe/Spirit sobre las 990 rondas elegibles conservaron ganador y marcador
objetivo sin repetir rondas: 29 incluyeron OT. Desviacion absoluta de kills: mediana 2,
percentil 95 de 4, maximo 7. Ensamblado local: mediana 4.5 ms, percentil 95 de 6.9 ms.
Son mediciones de este lote, no tolerancias garantizadas ni pruebas de realismo.

## Banco instalado y acceso reparado

El 29/10 se confirmo que las carpetas por demo eran propiedad de
`CodexSandboxOffline` y tenian la herencia de permisos desactivada. El proceso actual
corre como `tobia` sin elevacion, por lo que no podia leerlas ni cambiar sus permisos.
Se respaldo la ACL y, con elevacion UAC, se agrego Modify para el SID de `tobia`
solo en `cs2-data-lab/output/round-bank` y sus descendientes. No se cambio propietario,
no se otorgo acceso a Everyone y no se modificaron las demos originales.
Respaldo: `../cs2-data-lab/output/bank-permissions-backup-20261029/`.

La importacion destapo una discrepancia: eventos nativos con asistente del equipo
de la victima eran contados por el importador, pero no por el clasificador. El lector
ahora expone `assister` solo para otro aliado del atacante en una kill valida;
conserva `assister_steamid` original. Importador y visor usan ese credito coherente.
Las pruebas verifican que aun se rechazan totales realmente inconsistentes.

Las 990 rondas se importaron a `public/round-bank`, con SHA256 y estadisticas verificadas
antes de publicar `index.json`. No se regeneraron ni alteraron los replays fuente.
Chrome headless verifico `/bo1-lab`: cargos seleccionados, 18 rondas ensambladas,
cinco jugadores por bando, avance de reproduccion y carga de la segunda ronda,
sin errores JS ni HTTP de la aplicacion. Reporte:
`../cs2-data-lab/output/bo1-browser-smoke.json`.

## Pool visual y economia por contexto (estado actual)

`/bo1-lab` usa `public/round-bank/economy-index.json`, con `equipment_version: 2`.
Las 990 rondas originales siguen intactas; 932 tienen equipamiento reconocido.
El indice agrega `weaponEvidence`: cambios compactos de inventarios de armas,
pickups y muertes, derivados de los JSON ya existentes. No se reextrajeron demos
ni se cambiaron hashes originales. Se verificaron SHA y estadisticas al importar.
El indice anterior esta respaldado en
`../cs2-data-lab/output/economy-index-before-visual-pool-20261030.json`.

### Seleccion y continuidad visual

- La busqueda compara cantidades de rifles/SMG, AWP, Scout y actores sin primaria.
  AWP y SSG 08 son categorias distintas e inmutables; pistolas se representan con
  pistolas. La presencia de un arma secundaria observada sigue siendo una condicion
  independiente. El modelo exacto de rifle/SMG ya no agrega restricciones globales.
- `weaponAppearance` contiene correspondencias iniciales POR ACTOR, no una unica
  apariencia por tipo original para todos. Cinco armas originales iguales pueden
  representar tres M4A4 y dos M4A1-S. Una prueba real confirma las mismas 154 fuentes
  estructurales CT para ambas distribuciones, manteniendo fija la presencia de secundarias.
- `traceWeaponAppearances` asigna IDs visuales locales a cada arma y conserva su
  tipo original y apariencia. Las armas que salen de un inventario o de un muerto
  pasan a una pool; las nuevas adquisiciones usan esas identidades.
- Los inventarios muestreados y las muertes determinan la posesion. Los eventos
  de pickup por si solos no agregan/quitan armas: pueden contradecir el inventario
  del mismo tick. Primero se liberan las armas de todos los actores del tick y
  despues se resuelven las adquisiciones.
- Si el receptor aparece antes que el descarte del donante por el muestreo, se
  resuelve retrospectivamente una identidad provisional con una liberacion cercana
  (hasta dos pasos de muestra). Las opciones ambiguas se ordenan de forma estable.
  Esto no exige posicion de armas en el suelo ni descarta una ronda por ambiguedad.
- Los IDs son una reconstruccion visual, no identificadores fisicos nativos probados.
  Sin un origen observado resoluble se crea una identidad visual nueva compatible
  con el dato; no se agrega un evento de accion. Las limitaciones de muestreo siguen.
- Arma activa, inventarios, SVG y killfeed usan las identidades resueltas. `rawWeapon`
  conserva el nombre nativo del evento transformado. No cambian posiciones, bajas,
  asistencias ni resultados de la demo.
- El inventario final visible de los supervivientes vuelve al motor. Los muertos
  pierden su equipo. Los premios se calculan por cada baja con el arma visible en
  ese momento; una tabla global por tipo ya no alcanza para ello.

### Politica de compra implementada

La evidencia y las recomendaciones estan en
`../cs2-data-lab/docs/ECONOMY_DEMO_STUDY.md`. La politica del hibrido vive en
`src/lib/replayBuyPolicy.mjs`; las formulas macro y las acciones grabadas no cambian.

- Galil $1800, FAMAS $1950 y M4A4 $2900 segun las transacciones de las demos.
  La tabla compartida tambien actualiza esos precios para los motores antiguos.
- Pistol: plantillas coordinadas de armadura y pistolas por bando, con pesos de la
  muestra. T prioriza mas utilidad y CT mas chalecos; las pistolas pueden pagarse
  entre companeros con pagador y receptor registrados, sin transferir dinero.
- Segunda ronda: ANTI_ECO al ganador; T perdedor diferencia plant/no plant; CT
  perdedor combina force/ahorro y Scout con pesos observados. Se admite Scout sin
  armadura como perfil especifico, sin retirar globalmente la reserva de AWP.
- Tercera tras empezar 2-0: BONUS, con conservacion y reposicion de armas baratas,
  alguna mejora de SMG y sin apurar una AWP T. No se decide solo por el numero de ronda.
- Rondas intermedias: se calcula que jugadores pueden financiar armamento con su
  equipo guardado, armadura y reserva. Si una eco permite una compra posterior,
  hay alternativas seeded ECO/LIGHT/FORCE. La eco tiene un gasto maximo por jugador
  de $700 en pistolas, con reserva explicita, para evitar ciclos de force perpetua.
- Rifles/SMG se eligen entre opciones asequibles ponderadas, no siempre el mas caro.
  M4A1-S/M4A4 es una preferencia persistente por jugador. Se admite doble AWP CT
  ocasional cuando se puede financiar. Las armas enemigas guardadas siguen siendo validas.
- El Main AWPer puede recibir una AWP conservada intercambiando su primaria previa;
  no se duplica ni pierde el arma desplazada. Una compra para otro jugador la paga
  una sola persona y queda registrada. No se usa el pool sintetico del motor antiguo.
- El selector excluye rondas con supervivientes del perdedor en 12/24,
  27/30/33/... y cuando ese perdedor enfrenta matchpoint rival. Comparte el contexto
  con la compra FULL_DUMP. Es un proxy conservador: tambien excluye intentos reales
  que terminen con supervivientes; no detecta intencion ni cambia acciones de la demo.
  Verificacion: 150 partidas, 3424 rondas, 20 prorrogas, 358 rondas restringidas,
  cero fallos o reintentos. Reporte: `../cs2-data-lab/output/terminal-round-save-verification.json`.
- FULL_DUMP en 12/24, 27/30/33/... y matchpoint rival. Estar uno mismo en matchpoint
  no obliga por si solo a gastar todo. El presupuesto solo compra equipo util asequible.
- Se conservan estimaciones internas de armadura, casco y kit de supervivientes;
  el casco puede costar $350 cuando ya hay chaleco completo. Los muertos las pierden.
  La utilidad retenida se estima usando la proporcion observada de granadas iniciales
  y finales de la fuente, sin convertir esas cantidades en filtros de seleccion.
- Dinero, armadura, utilidad y kits permanecen ocultos. No se reconstruye dano exacto
  de armadura ni compras nativas individuales a partir del replay compacto: son
  estimaciones internas para decidir futuras compras, con importes auditados.

Los pesos y reservas son una primera politica informada por las demos, no un ajuste
estadistico validado fuera de muestra. La distribucion mostrada puede cambiar por
presupuesto, armas guardadas y cobertura. La prioridad es continuidad y variedad coherente.

### Busqueda, reintentos y comprobaciones

Se prueban hasta ocho variantes seeded de compra por estado y alternativas de fuente
/asignacion. Al no existir la equivalencia global, las asignaciones de ambos equipos
se calculan de forma independiente y se combinan sin materializar toda su matriz.
Se mantienen retroceso, memo de estados y limite de 1000 intentos.

Si falta cobertura, la pagina prueba hasta cinco semillas de ensamblado. El ganador,
marcador deseado y metas iniciales mantienen su semilla macro: nunca se vuelven a
sortear para encajar. Los errores de datos/codigo no se reintentan. El resultado
conserva `assemblySeed` y `retryCount`. Cada intento sigue siendo sincrono, con una
cesion al navegador entre intentos; no se agrego un Worker.

Validacion actual: **60 pruebas aprobadas**, ninguna omitida; build y ESLint aprobados.
La auditoria sin transformaciones recorre las 932 rondas y 3205 supervivientes:
ninguna diferencia de inventario final ni premios por actor, incluidas 12 rondas con
muertes simultaneas. Reporte: `../cs2-data-lab/output/pool-fidelity-audit.json`.

Lote final FaZe/Spirit: **101 mapas, 2360 rondas, cero reintentos de semilla**.
2309 rondas usan un tipo original con apariencias diferentes entre actores. En 129
rondas decodificadas se verifico que el inventario final mostrado coincide con el
estado economico; 397 bajas cambiaron de modelo visible. Cada gasto de armas,
armadura, utilidad y kits se concilia con el saldo del pagador. Reporte:
`../cs2-data-lab/output/visual-pool-economy-verification.json`.

Chrome verifico las 18 rondas del mapa por defecto, reproduccion, 86 cambios de arma,
mezcla de M4A4/M4A1-S, iconos del killfeed y economia oculta, sin errores JS/HTTP.
Generar y cargar la primera ronda tomo 233 ms. Reporte:
`../cs2-data-lab/output/visual-pool-economy-browser.json`.

La lista de jugadores muestra en grande el arma de fuego mas cara del inventario
visible, segun la tabla del motor, y al lado mas pequena el arma activa en mano.
Ambas se actualizan al cambiar el inventario; granadas, C4 y cuchillos no compiten
por el indicador grande. El arma activa y el killfeed usan los SVG de `public/weapons`;
sin SVG exacto o si falla su carga, queda texto. Lista: `MISSING_WEAPON_SVGS.md`.
El selector tiene dos pruebas propias; Chrome verifico 20 instantes de cuatro rondas
y 141 estados de jugadores vivos, incluidos 57 donde ambos indicadores difieren.
Reporte: `../cs2-data-lab/output/inventory-weapon-slot-browser.json`.

Los informes macro/economia/apariencias anteriores son historicos. No garantizamos
cobertura para cualquier semilla/equipo; las 58 rondas con tipos no soportados siguen
excluidas. No se extraen posiciones de armas caidas ni se afirma identidad fisica
individual en las recogidas ambiguas.

## Integracion en el torneo individual (30/10/2026)

`/play` incorpora cada jugador al equipo con un clic, sin pedir rol individual,
y exige seleccionar AWPer e IGL distintos al completar los cinco, antes
de iniciar el Major. Sus UIDs se conservan en standings y se pasan al motor de demos.
Los NPC usan roles de sus jugadores y una eleccion determinista si faltan.

`/simulation/match` usa `HybridMatchPlayer` y `RoundBankViewer` en modo partido.
Se genera cada mapa con una semilla independiente; todos son Mirage. Swiss normal
es BO1, clasificacion/eliminacion Swiss y cuartos/semifinales son BO3; la final
conserva el BO5 existente. Cada mapa reinicia su economia y termina al alcanzar la
mayoria de mapas. El resultado del torneo incluye el historial de mapas jugados.

El visor reproduce y pasa de ronda automaticamente, conserva pausa/velocidad/seek,
y revela marcador y K/D/A/flash assists al avanzar. Oculta resultados futuros en
las opciones y las referencias tecnicas de las demos. Se puede omitir el mapa y
continuar la serie, o volver al cuadro al finalizar. Los SVG usan las carpetas
`knifes`, `pistols`, `rifles_smg`, `scopes` y `other`.

El modo partido recupera la presentacion del visor anterior: marcador grande,
logos, distintivos T/CT y linea de rondas; reutiliza `MatchTimeline` y `PlayerCard`
de `CSMatchViewer` sin su motor de simulacion. Equipo A queda a la izquierda y B
a la derecha al cambiar de bando. En el centro va el radar, con las ultimas cinco
bajas en pequeno arriba a la derecha. Cada tarjeta muestra K/D/A, HP observada,
arma mas cara y arma activa mas pequena al lado. Las estadisticas completas se
abren en un desplegable. Chrome verifico diez tarjetas con HP, iconos de 24/15 px,
radar central, killfeed superpuesto y ausencia de desborde a 390 px.

Validacion: 69 pruebas aprobadas, ESLint de los archivos de integracion y build OK.
Chrome recorrio draft, roles obligatorios/distintos, BO1, avance
automatico y un BO3 de tres mapas hasta devolver el resultado al torneo, sin
excepciones JS. Reporte: `../cs2-data-lab/output/main-integration-browser.json`.
Tambien se generaron mapas para los 48 equipos del catalogo, sin fallos ni reintentos.

La organizacion, el torneo y el progreso del reproductor ahora se guardan localmente.
La recarga restaura el mapa, ronda, segundo y velocidad; empieza pausado. El UUID
del Major forma parte de la semilla y evita repetir los mismos mapas al iniciar
otro torneo. Detalles y limites: `ORGANIZATION_SYSTEM.md`.

Las salas multijugador ahora usan organizaciones confirmadas y el reproductor
de Mirage, con un nuevo UUID por Major. El ciclo lobby/confirmaciones/retorno se
probo en emuladores locales con tres usuarios. Ver `MULTIPLAYER_LOBBIES.md` para
alcance, pruebas y limites de autoridad/permisos pendientes. Las simulaciones de
NPC sin espectador conservan su motor anterior. No se desplegaron servicios reales.

## Proximas entregas

1. Estadisticas individuales historicas y renovacion de plantilla (offseason).
2. Calibrar la distribucion de compras con otros equipos/mapas reservados del ajuste,
   medir sesgos de cobertura y ampliar tipos si hace falta.
3. Integracion con salas y otros mapas.
