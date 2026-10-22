export async function subscribeToContentRefresh() {}

export async function listenForContentRefresh(_onVersion: (version: string) => void): Promise<() => void> {
  return () => {};
}
