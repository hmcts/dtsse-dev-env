
export function getSecretsFromJenkinsFile(jenkinsFile) {
  const secrets = jenkinsFile
    .match(/def secrets = (.*?)(?=\n\n)/s)[1]
    .replaceAll('[', '{')
    .replaceAll(']', '}')
    .replaceAll(/secret\((.*?),\s*(.*?)\)/g, '$2: $1')
    .replace(/",\s*}/g, '"}')
    .replace(/},\s}/g, '}\n}')
    .replace(/def secrets = /, '');

  const secretJson = JSON.parse(secrets);
  const promises = Object.entries(secretJson).flatMap(getSecretsFromEnv);

  return Promise.all(promises);
}

function getSecretsFromEnv([key, vaultSecrets]) {
  const vaultName = key.replace('${env}', 'aat');

  return Object.entries(vaultSecrets)
    .map(async ([envVariable, secretName]) => ([envVariable, await getSecretFromVault(vaultName, secretName)]));
}

export async function getSecretFromVault(vaultName, secretName) {
  const result = await $`az keyvault secret show --vault-name ${vaultName} -o tsv --query value --name ${secretName}`.text();
  return result.trim();
}
