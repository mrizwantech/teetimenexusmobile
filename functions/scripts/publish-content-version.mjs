import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const CONTENT_PROJECT = 'tee-time-nexus';
export const CONTENT_DOCUMENT = 'appConfig/publicContent';

export function releaseContentVersion(release, now = new Date(), nonce = randomUUID()) {
  if (typeof release !== 'string' || !/^\d+\.\d+\.\d+$/.test(release) || release.length > 24) {
    throw new Error('Provide a release version such as 1.2.0 (at most 24 characters).');
  }
  return `${release}-${now.toISOString().replace(/[-:.]/g, '')}-${nonce.slice(0, 8)}`;
}

export async function publishContentVersion(document, release) {
  const version = releaseContentVersion(release);
  await document.set({ version }, { merge: true });
  const saved = await document.get();
  if (saved.get('version') !== version) {
    throw new Error('The published content version could not be verified. Check Firestore before retrying.');
  }
  return version;
}

async function main() {
  const [release, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Usage: node functions/scripts/publish-content-version.mjs <version|--check|--show>');
  if (release !== '--check' && release !== '--show') releaseContentVersion(release);
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Release publishing must not target a Firestore emulator.');

  const { applicationDefault, initializeApp, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const credential = applicationDefault();
  await credential.getAccessToken();
  const app = initializeApp({ credential, projectId: CONTENT_PROJECT });
  const db = getFirestore(app);
  try {
    const document = db.doc(CONTENT_DOCUMENT);
    if (release === '--show') {
      const snapshot = await document.get();
      console.log(JSON.stringify(snapshot.get('version') ?? null));
    } else if (release === '--check') {
      await document.get();
      console.log(`Firebase credentials can read ${CONTENT_PROJECT}/${CONTENT_DOCUMENT}. Write permission is also required.`);
    } else {
      const version = await publishContentVersion(document, release);
      console.log(`Published public content version "${version}" to ${CONTENT_PROJECT}/${CONTENT_DOCUMENT}.`);
    }
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Content version publishing failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
