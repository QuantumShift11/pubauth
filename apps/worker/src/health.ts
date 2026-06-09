export function workerHealth() {
  return { ok: true, name: 'worker', time: new Date().toISOString() };
}
