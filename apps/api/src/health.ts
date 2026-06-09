export function health() {
  return { status: 'ok', service: 'api', time: new Date().toISOString() };
}
