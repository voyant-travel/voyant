export function normalizeLoopOptions({ iterations = "1", sleepSeconds = "60" } = {}) {
  return {
    iterations: positiveIntegerOption("iterations", iterations, { max: 100 }),
    sleepMs:
      positiveIntegerOption("sleep seconds", sleepSeconds, { allowZero: true, max: 3600 }) * 1000,
  }
}

export function shouldContinueLoop({ iteration, iterations, status }) {
  return status === 0 && iteration < iterations
}

function positiveIntegerOption(name, value, { allowZero = false, max } = {}) {
  const normalized = Number(value)
  const minimum = allowZero ? 0 : 1

  if (!Number.isInteger(normalized) || normalized < minimum || (max && normalized > max)) {
    const range = max ? `${minimum}..${max}` : `>= ${minimum}`
    throw new Error(`invalid ${name}: ${String(value)}; expected ${range}`)
  }

  return normalized
}
