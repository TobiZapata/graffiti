# Organizacion local y Hub

Primera entrega del GDD de organizaciones: identidad local permanente, plantilla,
roles, STAR y reanudacion del Major. Incluye perfil con resultados y resumenes
acumulados de Majors y enfrentamientos contra IA. No incluye todavia cuentas,
sincronizacion, rivalidades entre usuarios, offseason ni disband.

## Flujo

Inicio -> Mi organizacion (`/organization`) -> Crear organizacion (`/play`).
El draft incorpora cada jugador con un clic. Al completar cinco se eligen nombre,
escudo geometrico, dos colores, AWPer principal, IGL y STAR. AWPer e IGL deben ser
distintos; STAR puede coincidir con cualquiera. Se crea la organizacion y se vuelve
al Hub sin iniciar automaticamente un torneo.

El Hub muestra identidad y plantilla, permite iniciar el primer Major y continuar
el pendiente. Si existe progreso de un partido, continuar abre su reproductor;
si no, abre el cuadro. No se permite reemplazar una organizacion existente desde
el draft ni iniciar otro Major mientras el anterior sigue activo. Tras terminar,
otro Major conserva la misma organizacion y reinicia solo la competicion.

### Intercambio de roles en el Hub

Los cartelitos AWP, IGL y STAR se pueden arrastrar sobre otro jugador. Como
alternativa tactil y de teclado, se selecciona el cartelito y despues el nombre
de destino; Cancelar descarta la seleccion. Al mover AWP sobre el IGL o viceversa,
se intercambian sus titulares, manteniendo las dos funciones separadas. STAR
puede coincidir con cualquiera. Los cambios conservan identidad, plantilla e
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

80 pruebas pasan, incluido guardado/lectura, roles, referencias, rosters, progreso
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

Basado en `public/references/orgpage.jpg`: identidad centrada, metricas grandes,
resultados recientes y trofeos, fondo oscuro uniforme. En el espacio intermedio
se ubican la plantilla activa a la izquierda y jugadores historicos a la derecha;
en movil se apilan. La ventana historica indica los ultimos cinco pero sigue vacia:
no hay bajas de plantilla ni estadisticas individuales historicas implementadas.
No se inventan exjugadores ni rendimientos. Debajo se muestran enfrentamientos
reales contra IA. Evidencia visual: `../cs2-data-lab/output/organization-reference-desktop.png`
y `organization-reference-mobile.png`; las pruebas verifican ubicacion, datos
acumulados tras otro Major y ausencia de desborde a 390 px.
La regeneracion supone la misma version del motor y banco; una migracion futura
debera conservar la compatibilidad o versionar tambien el plan de los mapas.
Las salas ahora admiten organizaciones, confirmacion y regreso al lobby entre
Majors. Detalles y limites de la prueba local: `MULTIPLAYER_LOBBIES.md`.
