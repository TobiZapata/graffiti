# Firebase: datos y permisos

Modelo de jugadores actualizado: [PLAYER_MODEL_V2.md](PLAYER_MODEL_V2.md).
Las referencias a atributos anteriores describen el camino legacy.

El scoreboard K-D/Swing/ADR/KAST/Rating usa el sidecar local descrito en
[MATCH_METRICS.md](MATCH_METRICS.md). Los documentos online conservan sus
resultados compactos sin estadisticas; la vista las reconstruye de las rondas.

Proyecto graffity-major, Firestore Native (default), region nam5, plan gratuito.
Auth anonima habilitada. .env.local contiene solo configuracion publica del cliente;
los tokens de CLI o claves de servidor nunca se copian al frontend.

## Datos actuales

| Ruta | Contenido | Ciclo |
| --- | --- | --- |
| rooms/{code} | schemaVersion 3, host, miembros por UID, roles/listos, Major, abandonos del torneo y ultimo estado | La sala cerrada conserva el torneo como registro y sale del directorio. Un nuevo Major en el mismo lobby reemplaza el torneo previo. |
| roomSessions/{uid} | Sala unica, pageId/tabId, heartbeat de servidor, leaving | Se reserva al entrar, renueva cada 30s, vence a 180s y se elimina al salir/cerrar. |
| rooms/{code}/results/{majorId}~{matchId} | Resultado individual inmutable y remitente | Se incorpora al avanzar; se limpia al volver al lobby o cerrar. |
| organizationSessions/{organizationId} | Usuario, sala y Major que reservan la organizacion | Se libera al abandonar o terminar el Major. |
| users/{uid}/abandonments/{majorId} | Un abandono permanente, organizacion, sala, motivo y hora | Una entrada inmutable por usuario y Major. |

La organizacion, el historial individual y su torneo individual siguen en
localStorage. Draft y posicion del reproductor multiplayer usan sessionStorage.
El contador de abandonos se consulta por identidad anonima y organizationId; no es
una cuenta recuperable entre dispositivos. Cuenta, organizacion sincronizada,
estadisticas de jugadores e historial competitivo multiplayer completo siguen
pendientes. Demos, radar, indices y SVG son archivos estaticos, no Firestore.

## Permisos desplegados

Fuente firestore.rules, seleccionada por firebase.json. Se desplego el protocolo de
salas v3 y se comparo la fuente publicada con el archivo local.

- Sin autenticacion no se lee ni escribe. No hay regla wildcard abierta.
- El directorio solo lista salas publicas en lobby, limitado a 50. Privada significa
  no listada: un usuario autenticado con el codigo puede consultar el documento.
- Crear/entrar reserva la sesion unica por UID en la misma transaccion. No puede
  sobrescribirse una sesion activa ni cambiarse su sala/pageId/tabId al renovarla.
- Los miembros cambian solo su preparacion y organizacion validadas. El host puede
  cambiar participacion, iniciar, avanzar y devolver el torneo al lobby.
- Solo participantes del partido activo con sesion vigente crean su resultado.
  Equipos, puntajes y mapas deben ser coherentes con BO1/BO3/BO5. Los resultados no
  se sobrescriben. El host los relee en la transaccion para contabilizarlos una vez.
- Una salida propia o una sesion leaving/vencida permite una transaccion acotada
  de salida. Otro usuario no puede expulsar una sesion viva. Se registra una unica
  entrada de abandono, se libera su reserva y se transfiere host cuando corresponde.
- El host que sale del lobby lo cierra. Durante un Major se transfiere; si no queda
  nadie, el torneo se cancela sin campeon inventado. Salir despues de una final
  conserva el campeon y no registra abandono. Un espectador no recibe forfeit.
- Los W/O se calculan para cruces actuales/futuros, sin inventar mapas jugados ni
  kills. No reemplazan resultados ya completos. El host incorpora los balances.
- Las reservas de organizacion se validan atomicamente, incluso con ocho jugadores.
  El regreso rechaza una transaccion que deje reservas activas de sus participantes.
- El cierre libera las sesiones y limpia resultados. Una segunda consulta recoge
  resultados concurrentes que alcanzaron a entrar antes de cerrar; despues del
  cierre las reglas impiden crear otros. Las salas cerradas son registros, no se
  borran automaticamente.

## Presencia y limites

El navegador intenta marcar la salida en pagehide, pero no se depende de esa
peticion. La recarga detecta la sesion anterior de esa pestana; para cierres bruscos
hay un vencimiento de 180s validado por el servidor. Los miembros conectados y los
siguientes accesos concilian el estado. Si todos estan desconectados, no hay un
proceso programado que cambie documentos: se materializa la limpieza al siguiente
acceso. No se promete desconexion instantanea. Un dispositivo suspendido durante
mas del margen puede perder su sesion. Perder foco o minimizar no provoca una salida.

La exclusividad de sala por UID se exige en Firestore. Las pesta?as normales se
coordinan en cliente, pero Firestore no distingue dos clientes modificados que
usan el mismo UID. El host sigue coordinando la simulacion y los resultados son
declarados por los clientes; coherencia y permisos no prueban una partida legitima.
Autoridad en servidor y control de abuso de cuotas quedan pendientes.

## Compatibilidad

Los formatos previos quedan en solo lectura y no aparecen en el directorio nuevo.
Sus partidas se conservaron, sin agregar abandonos por la actualizacion.
Se respaldaron y liberaron dos reservas antiguas de U0ZG para que el protocolo
retirado no bloquee las organizaciones. Respaldo e informe externos:
firebase-legacy-locks-before-sessions.json y firebase-legacy-locks-released.json.
No se modificaron los resultados de esas salas ni se borraron sus historiales.

## Pruebas reproducibles

Con Java y Firebase CLI disponibles:

    firebase emulators:start --only auth,firestore --project demo-major-mvp --config tests/firebase-emulators.json
    npm run test:firestore
    npm run test:replay

Los emuladores usan las mismas reglas. El script de permisos crea un proyecto
demo aleatorio en localhost 8088 y limpia sus propios fixtures, nunca cloud.
Para desplegar solo reglas:

    firebase deploy --only firestore:rules --project graffity-major --config firebase.json

Validacion de esta entrega: 104 pruebas unitarias y 93 controles de permisos pasan;
builds normal/emulador con webpack y lint sin errores (avisos previos de imagenes).
Chrome paso 13 recorridos de salas tanto en emulador como en Firebase real:
roles, segunda pestana, foco, navegacion, recargas, cierre de host, transferencia,
forfeit, contador unico, W/O, cancelacion y replay oculta avanzando. Tambien completo
un Major real de 15 mapas, Swiss/playoffs/final, regreso y salida de ambos usuarios,
sin excepciones. El dialogo de roles se reviso a 390 y 1440 px.

Reportes externos en ../cs2-data-lab/output:
room-lifecycle-browser.json, firebase-room-lifecycle-browser.json,
firebase-sessions-cloud-major.json, firebase-room-sessions-rules.json y
firebase-session-fixtures-cleanup.json. Las pruebas cloud usaron organizaciones
TEST aisladas; sus salas, eventos y reservas se verificaron y limpiaron con respaldo.
No se activaron servicios pagos ni se agregaron dependencias.

Los reportes firebase-current-rules.json/probe-firestore-permissions.mjs conservan
el diagnostico historico: las reglas anteriores abiertas admitian ocho operaciones
indebidas. Ese fallo fue corregido; no se debe confundir con el estado actual.
