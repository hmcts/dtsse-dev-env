import { getSecretsFromJenkinsFile } from "./vault.mjs";
import { createMirrordConfig } from "./mirrord.mjs";

const environment = 'aat';
const tenantId = '531ff96d-0ae9-462a-8d2d-bec7c0b42082';

export async function deploy(product, component, type, user, namespace, chartName, jenkinsFile, chartFilename) {
  console.log(`Loading secrets in ${chalk.bold("Jenkinsfile_CNP")} from vaults...`);
  const secrets = await getSecretsFromJenkinsFile(jenkinsFile);
  const gitRemote = (await $`git config --get remote.origin.url`.text()).trim();
  const gitUrl = 'https://' + gitRemote.replace('git@', '').replace(':', '/');
  const serviceFqdn = `${chartName}-dev-${user}.preview.platform.hmcts.net`;
  const env = {
    CHANGE_ID: `${user}-DEV`,
    NAMESPACE: namespace,
    SERVICE_NAME: `${chartName}-dev-${user}`,
    SERVICE_FQDN: serviceFqdn,
    IMAGE_NAME: `hmctspublic.azurecr.io/${product}/${component}:latest`,
    ...Object.fromEntries(secrets),
  };

  console.log(`Creating values.preview.yaml from ${chalk.bold(chartFilename)}...`);
  await $({env})`cat ${chartFilename} | envsubst > charts/${chartName}/values.preview.yaml`;

  console.log('Fetching helm dependencies...');
  await $`helm dependency update charts/${chartName}`;

  const currentContext = (await $`kubectl config current-context`.text()).trim();

  const flags = [
    `${chartName}-dev-${user}`,
    `charts/${chartName}`
  ];

  if (await fs.exists(`charts/${chartName}/values.template.yaml`)) {
    console.log(`Creating values.templated.yaml from ${chalk.bold(`charts/${chartName}/values.template.yaml`)}...`);
    await $({env})`cat charts/${chartName}/values.template.yaml | envsubst > charts/${chartName}/values.templated.yaml`;
    flags.push(`-f`, `charts/${chartName}/values.templated.yaml`);
  }

  flags.push(
    `-f`, `charts/${chartName}/values.preview.yaml`,
    `--set`, `global.tenantId=${tenantId}`,
    `--set`, `global.environment=${environment}`,
    `--set`, `global.enableKeyVaults=true`,
    `--set`, `global.devMode=true`,
    `--set`, `global.tags.teamName=${namespace}`,
    `--set`, `global.tags.applicationName=${chartName}`,
    `--set`, `global.tags.builtFrom=${gitUrl}`,
    `--set`, `global.tags.businessArea=CFT`,
    `--set`, `global.tags.environment=development`,
    `--set`, `global.disableTraefikTls=`,
    `--namespace`, namespace,
    `--install`,
    `--wait`,
    `--timeout`, `1000s`
  );

  console.log(`Deploying helm chart to ${chalk.yellow.underline.bold(currentContext)}...`);
  await $({quiet: true})`helm upgrade ${flags}`;

  await Promise.all([
    await cleanup(chartName),
    await createMirrordConfig(namespace, chartName, user, type),
    await createEnvFile(serviceFqdn, user, namespace, chartName, type)
  ]);
}

async function createEnvFile(serviceFqdn, user, namespace, chartName, type) {
  const ingress = await $`kubectl get ingress -n ${namespace} -l app.kubernetes.io/instance=${chartName}-dev-${user} -o json`.text();
  const ingressJson = JSON.parse(ingress);
  const envVars = ingressJson.items
    .map(item => ([item.metadata.name, item.spec.rules[0].host]))
    .filter(([name]) => name !== `${chartName}-dev-${user}-${type}`)
    .map(([name, host]) => [getServiceEnvVarName(name, chartName, user), host])
    .map(values => values.join('=https://'))
    .join('\n') + `\nTEST_URL=https://${serviceFqdn}\n`;

  await fs.writeFile('.env.local', envVars);

  console.log(`Environment variables for service URLs have been set in ${chalk.bold('.env.local')}`);
}

function getServiceEnvVarName(name, chartName, user) {
  return name
    .replace(`${chartName}-dev-${user}-`, '')
    .toUpperCase()
    .replaceAll('-', '_') + '_URL';
}

async function cleanup(chartName) {
  console.log('Cleaning up...');
  await $`rm -rf charts/${chartName}/values.preview.yaml charts/${chartName}/Chart.lock charts/${chartName}/charts`;
  await $`rm -f charts/${chartName}/values.templated.yaml`;
}
