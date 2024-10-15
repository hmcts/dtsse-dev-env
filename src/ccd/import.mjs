import * as dotenvx from '@dotenvx/dotenvx';
import {getSecretFromVault} from "../vault/vault.mjs";

dotenvx.config({
  path: '.env.local',
  quiet: true
});

export async function importCcdDefinition() {
  const localEnv = dotenvx.config({
    path: '.env.local',
    quiet: true
  });

  const [CCD_API_GATEWAY_OAUTH2_CLIENT_SECRET, CCD_API_GATEWAY_S2S_KEY, DEFINITION_IMPORTER_USERNAME, DEFINITION_IMPORTER_PASSWORD] = await Promise.all([
    getSecretFromVault('ccd-aat', 'ccd-api-gateway-oauth2-client-secret'),
    getSecretFromVault('s2s-aat', 'microservicekey-ccd-gw'),
    getSecretFromVault('ccd-aat', 'definition-importer-username'),
    getSecretFromVault('ccd-aat', 'definition-importer-password')
  ])

  const env = {
    IDAM_API_URL_BASE: 'https://idam-api.aat.platform.hmcts.net',
    S2S_URL_BASE: 'http://rpe-service-auth-provider-aat.service.core-compute-aat.internal',
    CCD_API_GATEWAY_S2S_ID: 'ccd_gw',
    CCD_API_GATEWAY_OAUTH2_CLIENT_ID: 'ccd_gateway',
    CCD_API_GATEWAY_OAUTH2_REDIRECT_URL: 'https://www-ccd.aat.platform.hmcts.net/oauth2redirect',
    DEFINITION_STORE_URL_BASE: localEnv.parsed.CCD_DEFINITION_STORE_URL,
    CCD_API_GATEWAY_OAUTH2_CLIENT_SECRET,
    CCD_API_GATEWAY_S2S_KEY,
    DEFINITION_IMPORTER_USERNAME,
    DEFINITION_IMPORTER_PASSWORD
  };

  $({ env, verbose: true })`./gradlew highLevelDataSetup --args=PREVIEW`
}

