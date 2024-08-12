const SERVICE_AUTH_PROVIDER_URL = process.env.SERVICE_AUTH_PROVIDER_URL || "http://rpe-service-auth-provider-aat.service.core-compute-aat.internal";

export async function getS2SToken() {
  const response = await fetch(`${SERVICE_AUTH_PROVIDER_URL}/testing-support/lease`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ microservice: 'ccd_gw' })
  });

  return await response.text();
}

