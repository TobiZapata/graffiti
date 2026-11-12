# Cierre de rondas al cambiar de bando

Las replays originales de ronda 12, 24 y de cada mitad de overtime (27, 30,
33...) terminan como máximo siete segundos después del resultado. Una ronda
normal conserva el movimiento y los eventos de su tramo posterior al resultado.

En nuevos Majors (`bankVersion: mirage-economy-v2`), las rondas que ocupan esas
posiciones en el partido se congelan al resultado y terminan siete segundos
después. Se incluyen los eventos del tick de resolución, pero se descartan los
posteriores para posiciones, inventarios, bajas, asistencias, economía y métricas.
La pausa de quince segundos del cambio de lado no se agrega a la replay.

El mismo cierre se aplica a cualquier ronda que termina el mapa, aunque no sea
una de esas posiciones fijas. Se comprueba el ganador de cada ronda candidata
contra el marcador actual y la condición real de victoria del director, también
en overtime; llegar a match point por sí solo no congela una ronda.

`public/round-resolution-v1.json.gz` contiene los estados de resolución de las
932 rondas soportadas, asociados al SHA256 de cada replay. Se sirve desde la
aplicación, junto a las métricas; no requiere modificar el banco remoto original.
Después de importar otro banco, regenerar con `npm run bank:resolutions` e incluir
el archivo generado en la distribución de la aplicación.

Los Majors guardados con `mirage-economy-v1` y los anteriores sin descriptor
conservan su cálculo original de estadísticas y economía para permitir reconstruir
sus resultados. El recorte visual de las rondas originales de final de bando
también se aplica a ellos.

El visor también congela los finales de bando y la última ronda de estos Majors
anteriores, independientemente de que tengan datos complementarios de resolución.
Sus estadísticas históricas siguen conservándose; el laboratorio BO1 carga los
datos de resolución para sus nuevas generaciones.

Validación: `npm run test:replay` cubre el corte exacto, eventos del tick de
resolución, supervivientes, retroceso temporal y ensamblado con datos reales.
