# Salas y abandonos

## Reglas de uso

Cada usuario tiene una sola sala activa, reservada en roomSessions/{uid} al crear
o entrar. Otra pestana no puede abrir una segunda sala ni tomar la sesion original.
La navegacion dentro de /room/{code} conserva la sesion entre lobby, cuadro y replay.
Salir de ese conjunto de pantallas, recargar o cerrar termina la participacion.

Al completarse un match, el reproductor muestra un resumen con marcador, ganador y
estadisticas de jugadores y equipos por mapa y para toda la serie. La pantalla
conserva la sesion de sala, tambien si el rival confirma primero el resultado.
Back to Major queda habilitado al confirmar el guardado; un error permite reintentar.
El ultimo mapa abre el resumen automaticamente al terminar la reproduccion.

Firebase conserva el resultado liviano, sin filas de estadisticas. El resumen usa
los datos de la replay en memoria o reconstruye los mapas con su semilla original,
comprobando que coincidan marcador y ganador antes de mostrar las estadisticas.
Un mapa antiguo que no se puede reconstruir muestra datos no disponibles, nunca ceros
inventados. El guardado local de una partida individual conserva las filas por mapa.

| Accion | Lobby | Major en curso |
| --- | --- | --- |
| Invitado sale, recarga o navega fuera | Se retira del lobby | Abandono y W/O en sus cruces pendientes |
| Host hace lo mismo | La sala se cierra para todos | Abandono y transferencia a otro miembro activo |
| No queda ningun miembro activo | Sala cerrada | Major cancelado, sin campeon inventado |
| Perder foco, minimizar o cambiar de pestana | Permanece | La replay continua por tiempo transcurrido |
| Salir despues de la final | Salida normal | No agrega abandono ni elimina el campeon |

Salir durante un Major pide confirmacion al usar los enlaces. La recarga/cierre
usa tambien la advertencia nativa del navegador cuando este la permite.
La navegacion atras o una direccion escrita directamente tambien termina la sesion.
El boton Leave room sigue disponible; no es la unica forma de salir.

Edit roles abre un dialogo dentro del lobby: desmarca listo, edita AWPer/IGL/STAR
y guarda el snapshot sin navegar a la organizacion. AWPer e IGL se intercambian si
se asignan al mismo jugador. El Major fija los roles al arrancar; no hay offseason.

## Presencia y desconexiones

El servidor valida una sesion con heartbeat cada 30 segundos y vencimiento de
180 segundos. La renovacion no puede cambiar usuario, sala ni identidad de pagina,
y una sesion vencida no revive. El cambio de foco no es una senal de salida.
El controlador vive en el layout; desmontar una pantalla interna no abandona.

Al recargar, la nueva pagina reconoce la entrada anterior de esa pestana y realiza
la salida antes de mostrar el juego. Las pestanas nuevas o duplicadas quedan
bloqueadas; no reemplazan una sesion viva. pagehide intenta marcar leaving mediante
una peticion keepalive con token solo en memoria. No se depende de que esa peticion
llegue: existe el vencimiento para cierres bruscos, cierres forzados o perdida de red.
Los timestamps pendientes de confirmar no se interpretan como desconexion.

Los otros miembros concilian salidas y vencimientos; tambien se revisan al listar
salas o iniciar una sesion. Si no queda ningun cliente conectado, el vencimiento
impide operar y la limpieza se materializa al siguiente acceso. No hay un proceso
programado de backend: no se promete deteccion instantanea con todos desconectados.
La suspension completa de un dispositivo puede terminar venciendo la sesion.

## Forfeits e historial

Durante el Major, el miembro que abandona queda marcado left y su UID se conserva
en abandonedUids. El host restante resuelve automaticamente cruces actuales y
futuros por W/O, sin reescribir partidos ya terminados. Swiss suma cada resultado
una vez; los abandonados siguen recibiendo derrotas hasta ser eliminados. En
playoffs se entrega el cruce al rival. Si ambos abandonaron, el pase se resuelve
deterministicamente y el abandono sigue vigente para la siguiente ronda.
No se inventan mapas jugados, kills ni estadisticas de rendimiento para un W/O.

Cada abandono de un Major genera una entrada inmutable y unica en
users/{uid}/abandonments/{tournamentId}. El perfil de organizacion muestra la
cantidad de esas entradas para su organizationId. No cuenta salir del lobby,
ser espectador ni salir despues de terminar el torneo. Una recarga repetida no
duplica el registro. La identidad sigue siendo anonima del navegador, no una cuenta
recuperable entre dispositivos.

## Persistencia y concurrencia

Las salas nuevas usan schemaVersion 3 y miembros por UID con sessionId y left.
Crear/entrar y reservar la sesion es atomico; no se sobrescribe una reserva activa.
Cada jugador envia resultados individuales inmutables; el host los incorpora en
una transaccion junto con W/O pendientes. No avanza con partidos humanos pendientes.
Las organizaciones se reservan al arrancar y se liberan al abandonar o volver al
lobby. Una organizacion liberada puede jugar otro Major sin reactivar al equipo
abandonado en el anterior.

El host que sale del lobby lo cierra. Si sale durante el Major, se transfiere a otro
miembro que no haya salido. Las salas cerradas conservan el ultimo torneo como
registro y salen del directorio. Al cerrar se eliminan las sesiones y resultados
temporales; una segunda limpieza recoge envios concurrentes anteriores al cierre.
Tras la final se conserva el regreso al lobby, resultados consultables y otro Major
con nueva generacion, sin repetir el draft. El regreso elimina miembros que salieron.

Las salas anteriores se conservan como archivo de solo lectura. La actualizacion
de protocolo no genera abandonos. Se respaldaron y liberaron dos reservas del
formato anterior para que no bloqueen organizaciones en el sistema nuevo.

## Verificacion

Con Firebase CLI y Java instalados:

    firebase emulators:start --only auth,firestore --project demo-major-mvp --config tests/firebase-emulators.json
    npm run test:firestore
    npm run test:replay

El emulador usa las mismas firestore.rules de produccion. Las pruebas de permisos
usan proyectos demo aleatorios y limpian solo sus fixtures. Para la web local:

    $env:NEXT_PUBLIC_USE_FIREBASE_EMULATORS='true'
    node node_modules/next/dist/bin/next build --webpack
    npm run start -- --hostname 127.0.0.1 --port 3001

Sin esa variable se utiliza graffity-major y .next; con ella, Auth 9098, Firestore
8088 y .next-emulator. Reporte de navegador:
../cs2-data-lab/output/room-lifecycle-browser.json. Detalles de datos, despliegue
y pruebas cloud en FIREBASE_STORAGE.md.

## Limites

El host coordina el torneo y los resultados siguen declarados por clientes. Las
reglas verifican permisos y coherencia, no demuestran una simulacion legitima.
La exclusividad por usuario esta protegida en Firestore; un cliente modificado con
la misma autenticacion representa al mismo usuario y no una identidad de pestana
verificable en servidor. La coordinacion entre pestanas normales la hace el cliente.
Privada significa no listada: un usuario autenticado con el codigo puede consultarla.
Cuenta permanente, autoridad de servidor e historial competitivo completo siguen
pendientes. No se agregaron servicios pagos ni dependencias.
