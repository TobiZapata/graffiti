export function splitRadarTrail(trail, map) {
  const segments = [];
  for (const point of trail) {
    const previous = segments.at(-1)?.at(-1);
    if (!previous || (map.composite && (previous.z < map.composite.lowerBelowZ) !== (point.z < map.composite.lowerBelowZ))) {
      segments.push([]);
    }
    segments.at(-1).push(point);
  }
  return segments;
}
