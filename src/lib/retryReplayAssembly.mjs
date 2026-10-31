import seedrandom from 'seedrandom';

export async function retryReplayAssembly(assemble, seed) {
  const random = seedrandom(`${typeof seed}:${seed}:retries`);
  let assemblySeed = seed;
  for (let attempt = 0; attempt < 5; attempt++) {
    // Let the page render its busy state between synchronous assembly attempts.
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      return { ...assemble(assemblySeed), assemblySeed, retryCount: attempt };
    } catch (error) {
      if (error.code !== 'ROUND_BANK_COVERAGE') throw error;
      if (attempt === 4) throw new Error('No se pudo completar el partido tras 5 intentos. Falta cobertura de rondas para esta configuración.', { cause: error });
      assemblySeed = `${seed}:retry:${attempt + 1}:${random.int32()}`;
    }
  }
}
