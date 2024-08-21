import { getSecretsFromJenkinsFile } from "../vault/vault.mjs";
import { createMirrordConfig } from "./mirrord.mjs";
import envsub from "envsub/main.js";

const environment = 'aat';
const tenantId = '531ff96d-0ae9-462a-8d2d-bec7c0b42082';

export async function deploy(product, component, type, user, namespace, chartName, jenkinsFile, additionalChart) {
  const releaseName = `${chartName}-dev-pr-1-${user}`; // pr-1 is required for the idam redirect whitelist
  const serviceFqdn = `${releaseName}.preview.platform.hmcts.net`;

  const [gitUrl, currentContext] = await Promise.all([
    getGitUrl(),
    getCurrentContext(),
    createHelmFiles(product, component, releaseName, user, namespace, chartName, jenkinsFile, additionalChart),
    fetchHelmDependencies(chartName)
  ])

  if (!currentContext.includes('preview')) {
    console.log(`You are not in the preview cluster. Please run ${chalk.bold('kubectl config use-context cft-preview-NN-aks')}`);
    await cleanup(chartName);
    return;
  }

  const flags = [
    releaseName,
    `charts/${chartName}`,
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
    `--timeout`, `1000s`,
    `-f`, `charts/${chartName}/values.yaml`,
  ];

  if (await fs.exists(`charts/${chartName}/values.templated.yaml`)) {
    flags.push(`-f`, `charts/${chartName}/values.templated.yaml`);
  }

  flags.push(`-f`, `charts/${chartName}/values.preview.yaml`);

  if (await fs.exists(`charts/${chartName}/values.additional.yaml`)) {
    flags.push(`-f`, `charts/${chartName}/values.additional.yaml`);
  }

  console.log(`Deploying helm chart to ${chalk.yellow.underline.bold(currentContext)}...`);
  await $({quiet: true})`helm upgrade ${flags}`;

  await Promise.all([
    await cleanup(chartName),
    await createMirrordConfig(namespace, releaseName, type),
    await createEnvFile(serviceFqdn, namespace, type, releaseName)
  ]);
}

async function createEnvFile(serviceFqdn, namespace, type, releaseName) {
  const ingress = await $`kubectl get ingress -n ${namespace} -l app.kubernetes.io/instance=${releaseName} -o json`.text();
  const ingressJson = JSON.parse(ingress);
  const envVars = ingressJson.items
    .map(item => ([item.metadata.name, item.spec.rules[0].host]))
    .filter(([name]) => name !== `${releaseName}-${type}`)
    .map(([name, host]) => [getServiceEnvVarName(name, releaseName), host])
    .map(values => values.join('=https://'))
    .join('\n') + `\nTEST_URL=https://${serviceFqdn}\n`;

  await fs.writeFile('.env.local', envVars);

  console.log(`Environment variables for service URLs have been set in ${chalk.bold('.env.local')}`);
}

function getServiceEnvVarName(name, releaseName) {
  return name
    .replace(`${releaseName}-`, '')
    .toUpperCase()
    .replaceAll('-', '_') + '_URL';
}

async function cleanup(chartName) {
  console.log('Cleaning up...');
  await $`rm -rf charts/${chartName}/values.preview.yaml charts/${chartName}/Chart.lock charts/${chartName}/charts charts/${chartName}/values.templated.yaml charts/${chartName}/values.additional.yaml`;
}

async function createHelmFiles(product, component, releaseName, user, namespace, chartName, jenkinsFile, additionalChart) {
  console.log(`Loading secrets in ${chalk.bold("Jenkinsfile_CNP")} from vaults...`);
  const secrets = await getSecretsFromJenkinsFile(jenkinsFile);
  const env = {
    CHANGE_ID: `${user}-DEV`,
    NAMESPACE: namespace,
    SERVICE_NAME: releaseName,
    SERVICE_FQDN: `${releaseName}.preview.platform.hmcts.net`,
    IMAGE_NAME: `hmctspublic.azurecr.io/${product}/${component}:latest`,
    ...Object.fromEntries(secrets),
  };

  const envs = Object.entries(env).map(([name, value]) => ({name, value}));

  console.log(`Creating values.preview.yaml from ${chalk.bold('values.preview.template.yaml')}...`);
  await envsub({
    templateFile: `charts/${chartName}/values.preview.template.yaml`,
    outputFile: `charts/${chartName}/values.preview.yaml`,
    options: {envs}
  });

  if (additionalChart) {
    console.log(`Creating values.additional.yaml from ${chalk.bold(additionalChart)}...`);
    await envsub({
      templateFile: additionalChart,
      outputFile: `charts/${chartName}/values.additional.yaml`,
      options: {envs}
    });
  }

  if (await fs.exists(`charts/${chartName}/values.template.yaml`)) {
    console.log(`Creating values.templated.yaml from ${chalk.bold(`charts/${chartName}/values.template.yaml`)}...`);

    await envsub({
      templateFile: `charts/${chartName}/values.template.yaml`,
      outputFile: `charts/${chartName}/values.templated.yaml`,
      options: {envs}
    });
  }
}

async function fetchHelmDependencies(chartName) {
  console.log('Fetching Helm dependencies...');
  await $`helm dependency build charts/${chartName}`;
}

async function getCurrentContext() {
  return (await $`kubectl config current-context`.text()).trim();
}

async function getGitUrl() {
  const gitRemote = (await $`git config --get remote.origin.url`.text()).trim();
  return 'https://' + gitRemote.replace('git@', '').replace(':', '/');
}
