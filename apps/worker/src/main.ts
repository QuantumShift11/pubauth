export async function startWorkerService(): Promise<void> {
  console.log('PubAuth Worker service starting');
}

startWorkerService().catch((error) => {
  console.error('Worker service failed to start', error);
  process.exitCode = 1;
});
