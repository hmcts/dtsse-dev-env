
export function getSecretsFromJenkinsFile(jenkinsFile) {
  const secretStartIndex = jenkinsFile.indexOf('[', jenkinsFile.indexOf('def secrets = '));
  const secrets = jenkinsFile
    .substring(secretStartIndex, findLastClosingBracket(jenkinsFile, secretStartIndex) + 1)
    .replaceAll('[', '{')
    .replaceAll(']', '}')
    .replaceAll(/secret\((.*?),\s*(.*?)\)/g, '$2: $1')
    .replace(/",\s*}/g, '"}')
    .replace(/},\s}/g, '}\n}')
    .replaceAll(/\/\/.*/g, "")
    .replace(/def secrets = /, '');

  const secretJson = JSON.parse(secrets);
  const promises = Object.entries(secretJson).flatMap(getSecretsFromEnv);

  return Promise.all(promises);
}

function findLastClosingBracket(str, startIndex) {
  let count = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '[') {
      count++;
    } else if (str[i] === ']') {
      count--;
    }

    if (count === 0) {
      return i;
    }
  }
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
