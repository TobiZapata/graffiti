// Recorded evidence only. This module does not generate decisions or combat.
export function worldToRadar(point, map) {
  if (![point.x, point.y, map.originX, map.originY, map.scale].every(Number.isFinite) || map.scale <= 0) {
    throw new RangeError('Coordenadas o escala inválidas');
  }
  const offset = map.composite && (point.z < map.composite.lowerBelowZ ? map.composite.lower : map.composite.upper);
  return { x: (point.x - map.originX) / map.scale + (offset?.x ?? 0), y: (map.originY - point.y) / map.scale + (offset?.y ?? 0) };
}

function preceding(rows, time) {
  let low = 0, high = rows.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (rows[middle].t <= time) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

function interpolate(a, b, alpha) {
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha };
}

export function sampleRound(round, requestedTime) {
  if (!Number.isFinite(requestedTime) || !round.frames.length) throw new RangeError('Reproducción inválida');
  const time = Math.max(0, Math.min(round.duration, requestedTime));
  const frameIndex = preceding(round.frames, time);
  const before = round.frames[frameIndex], after = round.frames[frameIndex + 1] ?? before;
  const dt = after.t - before.t;
  const alpha = dt > 0 ? Math.max(0, Math.min(1, (time - before.t) / dt)) : 0;
  const events = round.events.filter(event => event.t <= time);
  const players = before.players.map(player => {
    const next = after.players.find(other => other.id === player.id);
    const result = { ...player };
    // Do not interpolate deaths, missing intervals or discontinuous positions.
    if (next?.alive && player.alive && dt > 0 && dt <= .3 && Math.hypot(next.x - player.x, next.y - player.y) / dt <= 600) {
      if (round.meta?.mode === 'generated' && next.motion?.length > 1) {
        const at = preceding(next.motion, time), a = next.motion[at], b = next.motion[at + 1] ?? a;
        const fraction = b.t > a.t ? Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t))) : 0;
        Object.assign(result, interpolate(a, b, fraction));
      } else {
        Object.assign(result, interpolate(player, next, alpha));
      }
      const turn = ((next.yaw - player.yaw + 540) % 360) - 180;
      result.yaw = player.yaw + turn * alpha;
    }
    for (const event of events) {
      const victim = event.victim ?? event.actor;
      if (victim !== player.id) continue;
      if (event.type === 'player_hurt' && event.t >= before.t && Number.isFinite(event.health)) result.health = event.health;
      if (event.type === 'player_death') {
        result.alive = false; result.health = 0;
        if ([event.x, event.y, event.z].every(Number.isFinite)) Object.assign(result, { x: event.x, y: event.y, z: event.z });
      }
    }
    return result;
  });
  const grenades = round.grenades.filter(grenade => grenade.points.length && time >= grenade.start && time <= grenade.end).map(grenade => {
    const index = preceding(grenade.points, time), a = grenade.points[index], b = grenade.points[index + 1] ?? a;
    const alpha = b.t > a.t ? Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t))) : 0;
    const point = interpolate(a, b, alpha);
    return { id: grenade.id, owner: grenade.owner, kind: grenade.kind, ...point,
      trail: [...grenade.points.filter(p => p.t <= time && p.t >= time - 1.5), point] };
  });
  const effects = round.effects.filter(effect => effect.start <= time && time < effect.end);
  const shots = events.filter(event => event.type === 'weapon_fire' && event.t >= time - .15).flatMap(event => {
    const frame = round.frames[preceding(round.frames, event.t)];
    const shooter = frame.t <= event.t ? frame.players.find(p => p.id === event.actor) : null;
    const x = event.x ?? shooter?.x, y = event.y ?? shooter?.y, z = event.z ?? shooter?.z, yaw = event.yaw ?? shooter?.yaw;
    if (![x, y, z, yaw].every(Number.isFinite)) return [];
    const radians = yaw * Math.PI / 180;
    return [{ ...event, x, y, z, yaw, endX: event.endX ?? x + Math.cos(radians) * 1500, endY: event.endY ?? y + Math.sin(radians) * 1500, endZ: event.endZ ?? z }];
  });
  let bomb = null;
  for (const event of events) {
    if (event.type === 'bomb_pickup' && !['planted', 'defused', 'exploded'].includes(bomb?.status)) {
      bomb = { status: 'carried', carrier: event.actor, t: event.t };
    } else if (event.type === 'bomb_dropped' && !['planted', 'defused', 'exploded'].includes(bomb?.status)) {
      bomb = { status: 'dropped', x: event.x, y: event.y, z: event.z, t: event.t };
    } else if (['bomb_planted', 'bomb_defused', 'bomb_exploded'].includes(event.type)) {
      // Terminal event coordinates can belong to the actor; keep the planted C4 position.
      const position = event.type !== 'bomb_planted' && bomb?.status === 'planted' ? bomb : event;
      bomb = { ...bomb, status: event.type.slice(5), x: position.x ?? bomb?.x, y: position.y ?? bomb?.y,
        z: position.z ?? bomb?.z, t: event.t };
    }
  }
  if (bomb?.status === 'carried') {
    const carrier = players.find(p => p.id === bomb.carrier);
    if (carrier) Object.assign(bomb, { x: carrier.x, y: carrier.y, z: carrier.z });
  }
  if (bomb && ![bomb.x, bomb.y].every(Number.isFinite)) bomb = null;
  if (round.meta?.mode === 'generated' && round.objectiveStates?.length) {
    bomb = { ...round.objectiveStates[preceding(round.objectiveStates, time)] };
    for (const event of events.filter(e => e.t > bomb.t)) {
      if (event.type === 'bomb_planted') Object.assign(bomb, { status: 'planted', carrier: null, plantedAt: event.plantedAt, explodeAt: event.explodeAt });
      if (event.type === 'bomb_defused') bomb.status = 'defused';
      if (event.type === 'bomb_exploded') bomb.status = 'exploded';
    }
    if (bomb.carrier && ['carried', 'planting'].includes(bomb.status)) {
      const carrier = players.find(p => p.id === bomb.carrier);
      if (carrier) Object.assign(bomb, { x: carrier.x, y: carrier.y, z: carrier.z });
    }
  }
  return { players, grenades, effects, events, shots, bomb, time, result: round.result && time >= round.result.t ? round.result : null };
}
