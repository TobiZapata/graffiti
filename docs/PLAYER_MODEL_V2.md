# Modelo de jugadores v2

Implementado el 4 de noviembre de 2026. El catalogo activo es
`src/data/teams.json`: 32 equipos y 160 entradas de DreamHack Winter 2013 y
PGL Major Krakow 2017. Se conservaron los puntajes editoriales aprobados.
Fuentes y criterio: `../cs2-data-lab/docs/PLAYER_CATALOG_DHW2013_KRAKOW2017.md`
y `../cs2-data-lab/docs/MAJOR_PLAYER_CLASSIFICATION_GUIDE.md`.

El scoreboard final agrega metricas de rendimiento calculadas desde las demos:
[MATCH_METRICS.md](MATCH_METRICS.md). No son nuevos atributos del catalogo.

## Datos e interfaz

Cada entrada conserva `id`, `personId`, `name`, `imageUrl` y cinco enteros
entre 0 y 100: `awp`, `rifler`, `igl`, `firepower`, `clutch`. Los cinco son
obligatorios; un dato parcial o invalido se rechaza, nunca genera stats al azar.
`imageUrl` puede ser null; no se agrego una interfaz de retratos.

Desde el 6 de noviembre de 2026, el catalogo agrega `country`: codigo ISO
3166-1 alfa-2 en minusculas (por ejemplo `se`, `br`, `ar`). Los futuros
jugadores deben incluirlo; si se desconoce, usar null y no inventar una bandera.
`PlayerIdentity` muestra bandera y nombre en draft, plantel, modales y scoreboards,
incluida la tabla inferior del replay. Las tarjetas y el killfeed en vivo conservan
su presentacion anterior. Las opciones nativas usan la bandera Unicode.
Las imagenes de 20/40 px se sirven desde [Flagcdn](https://flagcdn.com/), sin
lecturas adicionales de Firebase; ante un fallo se muestra el codigo del pais.
Para guardados anteriores, `player-countries.json` resuelve por `personId` o ID
historico, nunca por nick: los dos steel y AdreN/adreN son personas distintas.
No se migran ni alteran los puntajes guardados para mostrar las banderas.
Fuentes y casos con doble nacionalidad: [PLAYER_COUNTRIES.md](../../cs2-data-lab/docs/PLAYER_COUNTRIES.md).

AWP, Rifler, IGL y Clutch aparecen en draft, plantilla y modal. No hay Overall
para jugadores v2 ni Firepower visible. Los datos enviados al navegador siguen
siendo inspeccionables. `personId` evita elegir dos versiones de la misma persona.
Los roles del equipo son asignaciones independientes: AWPer e IGL pueden coincidir.
STAR se conserva y no agrega Firepower. Los NPC respetan los titulares historicos.

## Motor

- Fuerza base: promedio de `awp` del AWPer designado y `rifler` de los otros cuatro.
  El IGL agrega `clamp((igl - 70) * 0.1, -5, 5)`; la compatibilidad opcional conserva
  su efecto anterior. Desde motor 3, la probabilidad por mapa depende de la diferencia
  de fuerzas `d`: `0.5 + sign(d) * min(0.2, 0.1 * (abs(d) / 10)^1.5)`.
  Diferencias de 5/10/15/16 puntos dan 53.5/60/68.4/70 por ciento al favorito.
  El tope 70-30 es por mapa; una serie puede tener una ventaja acumulada mayor.
  No es una prediccion historica ni se modifico el peso de liderazgo.
- Firepower determina una tendencia de protagonismo durante todo el mapa:
  `(0.2 + firepower / 100)^1.5 * (0.65 + RNG * 0.7)`.
  Se sortean asignaciones entre permutaciones compatibles usando esa tendencia,
  las kills reales de los actores y azar independiente por ronda. No hay presupuesto
  de kills ni posiciones objetivo; las kills acumuladas no reducen la preferencia.
  La semilla conserva el buen/mal mapa y las asignaciones despues de recargar.
- Clutch agrega preferencia acotada al evaluar permutaciones de actores compatibles.
  Una oportunidad con supervivencia tiene mas peso que una sin supervivencia.
  No garantiza ganar ni inventa kills; no altera eventos ni inventarios fuente.
- El segundo sniper se prioriza por AWP. Las reglas de compatibilidad de armas,
  economia, apariencia y continuidad siguen vigentes.
- NPC contra NPC usan el mismo director, semilla por Major/partido/mapa y los
  formatos BO1/BO3/BO5 vigentes, sin descargar ni ensamblar replays.

Los coeficientes son calibracion inicial de juego, no formulas oficiales de HLTV.
Swing, rating observado y promedios historicos por jugador quedan para otro cambio.

## Compatibilidad y guardados

`src/data/teams-legacy.json` conserva exactamente el catalogo anterior. Los drafts
incompletos antiguos recuperan sus picks, stats, semilla y rerolls gastados; sus
nuevas ofertas provienen del catalogo activo. Se admiten planteles mixtos.

Los Majors activos conservan sus snapshots y su version del motor. No se
reescriben resultados, historial ni progreso. Antes de un nuevo Major individual,
solo se actualizan jugadores legacy cuya entrada y equipo/Major coinciden con el
catalogo aprobado. Se mantiene el puesto y se respalda la carrera original en
`major-mvp:career:v1:before-player-v2`. Si falla el respaldo, no se inicia el cambio.
Las entradas de 2014 sin calibracion nueva conservan sus atributos originales.

Al crear/entrar/preparar una sala, su nuevo snapshot aplica la misma actualizacion
de entradas verificadas; conserva la organizacion local y no modifica torneos ya
iniciados. `member.squad` y `member.organization.squad` siguen siendo iguales.

Los nuevos torneos guardan `simulation` con `engineVersion: 3`,
`playerDataVersion: "players-v2.0.0"`, `bankVersion: "mirage-economy-v1"`.
Las versiones desconocidas impiden reproducir/avanzar. Los torneos con motor 2
o sin descriptor mantienen la formula anterior de probabilidad, las cuotas de
kills y la asignacion anterior; no se recalculan con motor 3. El formato de
jugadores sigue siendo v2; la version 3 identifica el algoritmo del partido.
El banco actual no se modifico: no sobrescribirlo al publicar otro banco;
una nueva version exigira resolver y conservar sus archivos anteriores.

## Firebase y publicacion

Las reglas locales permiten el rol dual, validan los cinco scores v2 conservando
snapshots legacy, y mantienen inmutable el descriptor al avanzar el torneo.
No agregan stats a documentos de resultados ni cambian el protocolo de sala 3.

Las reglas se comprueban en emulador, no se desplegaron. Publicar primero las
reglas compatibles y luego la web. Coordinar la actualizacion con salas activas:
un bundle antiguo ya abierto desconoce este motor y no basta el descriptor para
obligarlo a recargar. No iniciar Majors con clientes de distintas versiones del motor.

Comprobaciones: `npm run test:replay`, `npm run lint`, `npm run build`,
`npm run test:firestore` con emulador local en 127.0.0.1:8088. La prueba de navegador
local recorre draft, rol dual, creacion, inicio, replay, recarga y resultado con
estadisticas reales, bloqueando endpoints de Firebase para no modificar cloud.

Resultado final de la comprobacion local del motor 3 (2026-11-05): 147 pruebas de aplicacion
y 117 de seguridad aprobadas, ninguna omitida. El emulador incluye ingreso,
preparacion, cambio de roles e inicio de una sala de ocho miembros con planteles
completos v2. La validacion compacta de rangos y la lectura de sesion cacheada
evitan exceder el presupuesto de expresiones de Firestore sin omitir scores.
Tambien se comprobo en Chrome la migracion con respaldo exacto de la carrera,
conservando jugadores de 2014 sin calibracion y reproduciendo el plantel mixto.
El golden del motor legacy conserva 100 planes y sus secuencias completas de rondas.
Otro golden conserva 100 planes del motor 2 con jugadores v2. Se verificaron cinco
ensamblados reales contra la implementacion anterior antes de retirar las cuotas.

Muestra de calibracion de 100 mapas sobre el banco real: una estrella de Firepower
95 paso de 20.02 kills de media (rango 11-37) a 19.82 (rango 6-44). La distancia
media entre maximo y minimo de su equipo paso de 12.67 a 12.77. Es una muestra
de mayor amplitud individual, no una demostracion de mas separacion general.
