#!/usr/bin/env node
import 'zx/globals';

await Promise.all([
  ensureHelmInstalled(),
  ensureAzureCliInstalled(),
  ensureAzureCliLoggedIn(),
  ensureJenkinsFileExists(),
]);

const jenkinsFile = (await fs.readFile('Jenkinsfile_CNP', 'utf8')).replaceAll("'", '"');
const type = jenkinsFile.match(/def type = "(.*?)"/)[1];
const product = jenkinsFile.match(/def product = "(.*?)"/)[1];
const component = jenkinsFile.match(/def component = "(.*?)"/)[1];
const user = (await $`whoami`.text()).trim();
const namespace = product;
const chartName = product + '-' + component;

// await ensurePreviewChartExists(product, component);

if (argv.delete) {
  await destroy();
} else {
  await deploy();
}

async function deploy() {
  console.log('Loading secrets in Jenkinsfile_CNP from vaults...');
  const secrets = await getSecretsFromJenkinsFile(jenkinsFile);
  const environment = 'aat';
  const tenantId = '531ff96d-0ae9-462a-8d2d-bec7c0b42082';
  const gitRemote = (await $`git config --get remote.origin.url`.text()).trim();
  const gitUrl = 'https://' + gitRemote.replace('git@', '').replace(':', '/');

  const env = {
    CHANGE_ID: `${user}-DEV`,
    NAMESPACE: namespace,
    SERVICE_NAME: chartName,
    SERVICE_FQDN: `${chartName}-dev-${user}.preview.platform.hmcts.net`,
    IMAGE_NAME: `hmctspublic.azurecr.io/${product}/${component}:latest`,
    ...Object.fromEntries(secrets),
  };

  console.log('Templating values.preview.yaml...');
  await $({
    env,
  })`cat charts/${chartName}/values.preview.template.yaml | envsubst | tee charts/${chartName}/values.preview.yaml`;

  console.log('Fetching helm dependencies...');
  await $`helm dependency update charts/${chartName}`;

  const currentContext = (await $`kubectl config current-context`.text()).trim();

  console.log(`Deploying helm chart to ${currentContext}...`);
  await $`helm upgrade ${chartName}-dev-${user} charts/${chartName} \
 -f charts/${chartName}/values.preview.yaml \
 --set global.tenantId=${tenantId} \
 --set global.environment=${environment} \
 --set global.enableKeyVaults=true \
 --set global.devMode=true \
 --set global.tags.teamName=${namespace} \
 --set global.tags.applicationName=${chartName} \
 --set global.tags.builtFrom=${gitUrl} \
 --set global.tags.businessArea=CFT \
 --set global.tags.environment=development \
 --set global.disableTraefikTls= \
 --namespace ${namespace} \
 --install \
 --wait \
 --timeout 1000s`;

  console.log('Cleaning up...');
  await $`rm -rf charts/${chartName}/values.preview.yaml charts/${chartName}/Chart.lock charts/${chartName}/charts`;

  console.log('Setting up mirrord...');
  const podName = (
    await $`kubectl get pods -n ${namespace} -l app.kubernetes.io/name=${chartName}-dev-${user}-${type} -o jsonpath='{.items[0].metadata.name}'`.text()
  ).trim();
  const mirrordConfig = {
    feature: {
      network: {
        incoming: 'steal',
        outgoing: true,
      },
      fs: 'read',
      env: true,
    },
    target: {
      path: {
        pod: podName,
      },
      namespace: namespace,
    },
    operator: false,
    agent: {
      flush_connections: false,
    },
  };

  await fs.writeJson('.mirrord/mirrord.json', mirrordConfig, { spaces: 2 });
}

async function destroy() {
  console.log('Destroying helm chart...');
  await $`helm uninstall ${chartName}-dev-${user} --namespace ${namespace}`;
}

function getSecretsFromJenkinsFile(jenkinsFile) {
  const secrets = jenkinsFile
    .match(/def secrets = (.*?)(?=\n\n)/s)[1]
    .replaceAll('[', '{')
    .replaceAll(']', '}')
    .replaceAll(/secret\((.*?),\s*(.*?)\)/g, '$1: $2')
    .replace(/",\s*}/g, '"}')
    .replace(/},\s}/g, '}\n}')
    .replace(/def secrets = /, '');

  const secretJson = JSON.parse(secrets);
  const promises = Object.entries(secretJson).flatMap(getSecretsFromEnv);

  return Promise.all(promises);
}

function getSecretsFromEnv([key, vaultSecrets]) {
  const vaultName = key.replace('${env}', 'aat');

  return Object.entries(vaultSecrets).map(async ([secretName, envVariable]) => {
    const secretValue =
      await $`az keyvault secret show --vault-name ${vaultName} -o tsv --query value --name ${secretName}`.text();

    return [envVariable, secretValue.trim()];
  });
}

async function ensureHelmInstalled() {
  if (!(await which('helm'))) {
    console.error('Helm not found.');
    process.exit(1);
  }
}

async function ensureAzureCliInstalled() {
  if (!(await which('az'))) {
    console.error('Azure CLI not found.');
    process.exit(1);
  }
}

async function ensureAzureCliLoggedIn() {
  if (await $`az account show`.exitCode) {
    console.error('Azure CLI not logged in. Log in with `az login`.');
    process.exit(1);
  }
}

async function ensurePreviewChartExists(product, component) {
  const [chartExists, previewExists] = await Promise.all([
    fs.exists(`charts/${product}-${component}/Chart.yaml`),
    fs.exists(`charts/${product}-${component}/values.preview.template.yaml`),
  ]);

  if (!chartExists || !previewExists) {
    console.error(`Preview chart not found. Ensure that you have a chart at charts/${product}-${component}.`);
    process.exit(1);
  }
}

async function ensureJenkinsFileExists() {
  if (!(await fs.exists('Jenkinsfile_CNP'))) {
    console.error('Jenkinsfile_CNP not found. Ensure that you run this from the root of the repository.');
    process.exit(1);
  }
}
