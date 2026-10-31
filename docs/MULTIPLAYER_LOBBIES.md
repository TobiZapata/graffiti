# Salas entre Majors

La organizacion local se puede usar en salas publicas y privadas. Esta entrega no
decide reglas de bajas, reemplazos ni offseason; todos conservan sus cinco jugadores.

## Flujo disponible

- `/multiplayer`: lista de salas publicas actualizable, crear sala publica/privada
  y entrar con codigo. Se necesita organizacion y sesion anonima de Firebase Auth.
- `/room/[id]`: organizaciones, plantillas, roles y estados Preparando equipo,
  Listo, En partida o No participa. Cada persona confirma su propio equipo.
- Preparar equipo quita Listo antes de abrir el Hub y permite regresar a la sala.
  La membresia permanece. Confirmar publica una copia actual de identidad/plantilla;
  no se sube el historial local completo de la organizacion.
- El host puede excluir a alguien solo del proximo Major, manteniendolo en el lobby.
  El arranque requiere al menos un participante y todos los incluidos listos.
  Se completa el cuadro con NPC del catalogo local hasta dieciseis equipos.
- El Major fija equipos y roles. Usa el reproductor de demos: todos los mapas son
  Mirage, incluidos BO3 y BO5. Cada usuario conserva su posicion en sessionStorage
  de esa pestana; una recarga vuelve al mismo mapa/ronda/segundo.
- Tras la final, el host devuelve a todos al mismo lobby. Se liberan reservas,
  se restablece participacion y se solicita una nueva confirmacion. El ultimo
  resultado queda consultable mientras no se inicie el siguiente Major.
- Otro arranque crea un tournamentId y una generacion nuevos. No se repite el draft.
  La ruta antigua `/room/[id]/draft` redirige al lobby.

## Concurrencia

`roomService` usa transacciones para altas, bajas, confirmaciones, participacion,
arranque y regreso. La creacion no sobrescribe codigos existentes. Las consultas
de salas publicas filtran visibility/status antes de leer y se limitan a cincuenta.

Al arrancar se reservan las organizaciones participantes en
`organizationSessions/{organizationId}`. Una reserva existente impide empezar
otro Major con la misma organizacion en otra sala. Al regresar tras una final
valida, se liberan solo las reservas correspondientes a esa sala y tournamentId.

El contexto multijugador tambien usa transacciones para resultados y avance.
Comprueba usuario participante, equipos, ganador/puntaje, torneo vigente y estado
de ronda. Un partido completado no vuelve a sumar victorias. No se permite avanzar
con partidas humanas pendientes. Los equipos publicados no siguen los cambios
posteriores del Hub.

## Prueba local

Se utiliza un proyecto demo sin servicios reales ni facturacion:

```powershell
firebase emulators:start --only auth,firestore --project demo-major-mvp --config tests/firebase-emulators.json
```

En otra terminal:

```powershell
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATORS='true'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3001
```

Esa variable selecciona datos ficticios, Auth 9098, Firestore 8088 y el directorio
`.next-emulator`. Sin ella se conserva la configuracion Firebase existente y `.next`.
El origen 3001 tiene un guardado de organizacion separado del de 3000.

`tests/firestore-emulator.rules` permite pruebas autenticadas locales: **no son
reglas de produccion y no deben desplegarse**. Ninguna regla o recurso real fue
publicado o cambiado durante esta entrega.

Verificacion: 85 pruebas unitarias, ESLint de integracion y build. Chrome con tres
usuarios anonimos y Firestore/Auth locales verifico altas simultaneas, confirmacion,
exclusion sin expulsion, preparacion, salas privadas ocultas, reserva de organizacion,
partidas reales de Mirage y resultados concurrentes sin duplicar victorias.
Para probar el regreso se inserto una final terminada en el emulador; no se jugo
un Major multijugador entero. Se verificaron regreso al mismo lobby, consulta del
ultimo resultado y segundo arranque. Reporte:
`../cs2-data-lab/output/multiplayer-browser.json`.

## Limites actuales

La autenticacion anonima identifica al usuario del navegador; la organizacion
sigue siendo local y se comparte una copia con la sala, sin sincronizacion de
cuenta ni historial competitivo multijugador permanente. Los resultados siguen
calculados por clientes. Las comprobaciones del SDK no sustituyen reglas Firebase
de produccion ni un servidor que determine resultados: falta validar esos permisos
y autoridad antes de presentar el modo como competicion publica protegida.

Una reserva puede quedar pendiente si el host abandona definitivamente o se borra
la sala externamente. No se implemento recuperacion de host ni caducidad de reservas.
El bloqueo abarca estas salas, no el torneo individual local. No hay chat ni draft
de reemplazos todavia. El indice de la consulta publica puede necesitar configuracion
en el proyecto Firestore real.
