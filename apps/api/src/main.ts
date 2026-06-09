export async function startApiService(): Promise<void> {
  console.log('PubAuth API service starting');
}

startApiService().catch((error) => {
  console.error('API service failed to start', error);
  process.exitCode = 1;
});
