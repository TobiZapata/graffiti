# Organizacion local y Hub

Modelo de jugadores actualizado: [PLAYER_MODEL_V2.md](PLAYER_MODEL_V2.md).
Las referencias a atributos anteriores describen el camino legacy.

Primera entrega del GDD de organizaciones: identidad local permanente, plantilla,
roles, STAR y reanudacion del Major. Incluye perfil con resultados y resumenes
acumulados de Majors y enfrentamientos contra IA. No incluye todavia cuentas,
sincronizacion, rivalidades entre usuarios, offseason ni disband.

## Flujo

Inicio -> Mi organizacion (`/organization`) -> Crear organizacion (`/play`).
Cada ronda del draft muestra equipos, Major completo y nombres sin estadisticas.
Elegir un equipo bloquea las alternativas y los rerolls, incluso al recargar;
entonces se revela una estadistica segun el rol natural y se elige un jugador.
Los picks no se pueden quitar. Your squad aparece debajo de las ofertas.
Al completar cinco se eligen nombre (maximo 28 caracteres),
escudo geometrico, dos colores, AWPer principal, IGL y STAR. AWPer e IGL pueden
coincidir; STAR puede coincidir con cualquiera. Se crea la organizacion y se vuelve
al Hub sin iniciar automaticamente un torneo.

El formulario de identidad esta centrado; debajo, el roster permite mover roles
por arrastre o seleccion y clic, igual que en la organizacion.

El Hub muestra identidad y plantilla, permite iniciar el primer Major y continuar
el pendiente. Si existe progreso de un partido, continuar abre su reproductor;
si no, abre el cuadro. No se permite reemplazar una organizacion existente desde
el draft ni iniciar otro Major mientras el anterior sigue activo. Tras terminar,
otro Major conserva la misma organizacion y reinicia solo la competicion.

### Intercambio de roles en el Hub

Los cartelitos AWP, IGL y STAR se pueden arrastrar sobre otro jugador. Como
alternativa tactil y de teclado, se selecciona el cartelito y despues el nombre
de destino; Cancelar descarta la seleccion. Cada cargo se mueve de forma independiente:
AWP e IGL pueden coincidir. STAR puede coincidir con cualquiera. Los cambios conservan identidad, plantilla e
historial y se guardan mediante el mismo documento local.

El circulo `i` abre un dialogo nativo con la funcion de cada rol y las instrucciones;
mantiene el foco y se cierra con Escape, su boton o el fondo. Explica que la
proteccion de STAR se activara con la futura offseason. Los roles editados son
los del proximo Major: la competicion en curso conserva sus equipos, roles y
progreso, para permitir la misma reproduccion despues de una recarga.

## Guardado

`TournamentContext` hidrata antes de montar los consumidores del torneo. Persiste
un documento JSON versionado en `localStorage`, clave `major-mvp:career:v1`:

- `organization`: UUID, fecha, nombre, SVG del escudo, colores, cinco jugadores y
  UIDs de AWPer/IGL/STAR. Los UIDs corresponden a los indices estables del draft.
  `majorHistory` es opcional para partidas anteriores: conserva resumenes de
  torneos terminados al iniciar el siguiente, deduplicados por UUID.
- `tournament`: UUID del Major, plantilla expandida, fase, cuadro, resultados y
  standings. Las plantillas expandidas se guardan para conservar sus atributos.
- `matchProgress`: mapas terminados de cada serie pendiente, mapa visto y posicion
  del reproductor (indice de ronda, segundo y velocidad).

Los mapas se regeneran con semilla `${tournamentId}:${matchId}-map${index}` y el
mismo snapshot de equipos. No se guardan todos los replays en localStorage. El
tiempo se guarda por segundo, y la reanudacion empieza pausada. Al completar un
partido se elimina su progreso y se registra el resultado una sola vez.

Las lecturas y escrituras validan el documento. JSON corrupto, una version no
reconocida o referencias invalidas muestran un error y conservan el original.
Errores de almacenamiento no se presentan como un guardado exitoso. Si otra
pestana cambia la partida, se bloquean las escrituras de la pestana vieja y se
indica recargarla para recuperar el estado mas reciente.

## Verificacion y limites

90 pruebas pasan, incluido guardado/lectura, roles, referencias, rosters, progreso
de series y fallos de almacenamiento. ESLint de los archivos de integracion y
build pasan. Chrome verifico creacion, colores/roles/STAR, recarga del Hub, ronda
3 a 37 segundos y velocidad 4x, salida y retorno, BO3 entre mapas, proteccion
entre pestanas, conservacion de JSON corrupto y nuevo Major con la misma identidad.
Sin excepciones JS ni desborde del Hub a 390 px.
La prueba tambien cubre eventos drag/drop, intercambio AWP/IGL, superposicion STAR,
seleccion por clic y Enter, ayuda y Escape, persistencia y aplicacion de los roles
al siguiente Major sin modificar la competicion en curso.

Reporte: `../cs2-data-lab/output/career-browser.json`.

El guardado depende de este navegador y origen (localhost y 127.0.0.1 tienen
almacenamientos distintos); borrar sus datos lo elimina. No hay copia en servidor.
Solo se conserva el cuadro completo del torneo mas reciente. Antes de iniciar
otro, se archivan el puesto final y los rivales/victorias del anterior para
calcular winrate, partidos, participaciones, campeonatos y finales acumulados.
Una serie BO3/BO5 cuenta como un partido. Rivales de distintas ediciones historicas
se distinguen por nombre y Major de origen. Los datos ya perdidos antes de esta
entrega no pueden reconstruirse.

## Perfil visual

El rediseño usa AppBar, superficies oscuras y controles compartidos. El Hub muestra
el siguiente partido o arranque de Major, plantilla activa con roles editables,
estadisticas, jugadores historicos y rivalidades. En movil se apilan. La ventana
historica sigue vacia: no hay bajas ni estadisticas individuales historicas
implementadas. No se inventan exjugadores ni rendimientos.
La regeneracion supone la misma version del motor y banco; una migracion futura
debera conservar la compatibilidad o versionar tambien el plan de los mapas.
Las salas ahora admiten organizaciones, confirmacion y regreso al lobby entre
Majors. Detalles y limites de la prueba local: `MULTIPLAYER_LOBBIES.md`.

## Draft y correcciones de UI

La oferta del draft deriva de una semilla guardada en sessionStorage, la cantidad
de picks y los rerolls restantes. Recargar conserva la oferta y el equipo elegido;
no concede rerolls gratuitos. Los rerolls gastados no se recuperan. Los drafts antiguos sin semilla
conservan su plantilla valida y contador, y reciben una nueva oferta una sola vez.

El cuadro Swiss reconstruye los balances de entrada desde los resultados de las
rondas anteriores, incluso al leer partidas viejas con snapshots modificados.
Los resultados siempre muestran la posicion individual. Se retiro el MVP calculado
con atributos y nombre: no era una estadistica real del torneo.

Chrome verifico estas correcciones, guardado y reanudacion del replay, roles del
Major congelados y posicion final de semifinales sin MVP. Hub a 390 px sin
desborde. Reporte: `../cs2-data-lab/output/ui-regressions.json`.

## Record, Rivalries y rating de carrera

Record y Rivalries tienen filtros independientes Offline/Online. Rivalries muestra
los cinco rivales con mas series jugadas por modo, con escudo y Major completo
debajo del nombre cuando corresponde. Cada edicion historica sigue siendo un rival
distinto; las organizaciones online se identifican por UUID. Recent Majors muestra
solo el resultado a la izquierda.

Los registros anteriores sin modo se conservan en Offline: no contienen datos para
reclasificarlos con certeza. Los nuevos resultados online se marcan explicitamente.
Ambos modos incluyen partidos del Major en curso cuando estan incorporados al cuadro.

Cada jugador muestra una estadistica segun su rol asignado: AWP, IGL o Rifler;
AWP tiene prioridad si comparte ambos roles. STAR no altera la estadistica mostrada.
El rating a su derecha es la media de los ratings reales por serie con metricas,
incluyendo ambos modos. Se conserva en el banco y los exjugadores retenidos.
No se inventan ratings para resultados antiguos sin metricas: se muestra un guion
cuando no hay ninguno. El cierre del Major persiste los totales una sola vez.
