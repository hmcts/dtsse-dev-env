import {getS2SToken} from "../auth/s2s.mjs";
import {getIdamToken} from "../auth/idam.mjs";
import * as dotenvx from '@dotenvx/dotenvx';

dotenvx.config({
  path: '.env.local',
  quiet: true
});

const CCD_DEFINITION_STORE_API_URL = process.env.CCD_DEFINITION_STORE_API_URL;

export async function importCcdDefinition(definitionPath) {
  const [s2sToken, idamToken] = await Promise.all([getS2SToken(), getIdamToken(), waitForDefinitionStore()]);

  const uploadFilename = definitionPath.split('/').pop();
  const form = new FormData();
  const fileBuffer = await fs.promises.readFile(definitionPath);
  form.append('file', new Blob([fileBuffer]), uploadFilename);

  const uploadResponse = await fetch(`${CCD_DEFINITION_STORE_API_URL}/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
      'ServiceAuthorization': s2sToken,
      'Authorization': `Bearer ${idamToken}`
    },
    body: form
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to import definition: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }
  console.log(await uploadResponse.text());
}

async function waitForDefinitionStore() {
  // wait for def store to be healthy
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(CCD_DEFINITION_STORE_API_URL + "/health");
      if (response.ok) {
        const json = await response.json();
        if (json.status === "UP") {
          return;
        }
      }
    } catch (e) {
      // ignore
    }

  }
  throw new Error("Definition store not healthy");
}
