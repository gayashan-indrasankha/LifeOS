export async function verifyCloudOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error('LIFEOS_CLOUD_URL must be an HTTPS origin without credentials or a path.');
  }
  let response;
  try {
    response = await fetch(`${url.origin}/api/health`, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
  } catch {
    throw new Error('The configured LifeOS cloud service could not be reached.');
  }
  if (!response.ok || (await response.json().catch(() => null))?.status !== 'ok') {
    throw new Error('The configured LifeOS cloud service is not healthy.');
  }
  return url.origin;
}
