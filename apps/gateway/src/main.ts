export async function startGatewayService(): Promise<void> {
  console.log('PubAuth Gateway service starting');
}

startGatewayService().catch((error) => {
  console.error('Gateway service failed to start', error);
  process.exitCode = 1;
});
