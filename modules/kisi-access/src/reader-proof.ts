export async function waitForReaderProof(read: () => Promise<string>, timeoutMs = 10000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return await read();
    } catch (failure) {
      if (!(failure instanceof Error) || ![
        'The entrance reader is not nearby.',
        'No fresh entrance reader signal.',
      ].some((message) => failure.message.includes(message))) {
        throw failure;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error('No signal detected from the configured entrance reader. Check Bluetooth, Location Services and app permissions, and confirm the reader is online and linked to the configured entrance lock.');
      }
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(500, remaining)));
    }
  }
}
