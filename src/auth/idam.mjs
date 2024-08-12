
import { getSecretFromVault } from "../vault/vault.mjs";

const IDAM_URL = process.env.IDAM_URL || 'https://idam-api.aat.platform.hmcts.net';

export async function getIdamToken() {
  const clientId = 'ccd_gateway';
  const redirectUri = 'https://www-ccd.aat.platform.hmcts.net/oauth2redirect';
  const [clientSecret, username, password] = await Promise.all([
    getSecretFromVault("ccd-aat", "ccd-api-gateway-oauth2-client-secret"),
    getSecretFromVault("ccd-aat", "definition-importer-username"),
    getSecretFromVault("ccd-aat", "definition-importer-password")
  ]);

  const authResponse = await fetch(`${IDAM_URL}/oauth2/authorize?redirect_uri=${redirectUri}&response_type=code&client_id=${clientId}`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const authJson = await authResponse.json();
  const code = authJson.code;

  const tokenResponse = await fetch(`${IDAM_URL}/oauth2/token?code=${code}&redirect_uri=${redirectUri}&grant_type=authorization_code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`ccd_gateway:${clientSecret}`).toString('base64')
    }
  });

  const tokenJson = await tokenResponse.json();

  if (!tokenJson.access_token) {
    throw new Error('Failed to get IDAM token. Response: ' + JSON.stringify(tokenJson));
  }

  return tokenJson.access_token;
}
