import { getReleaseName } from "./release.mjs";

export async function deleteDeployment(chartName, user, namespace) {
  console.log('Deleting helm chart...');
  await $`helm uninstall ${getReleaseName(chartName, user)} --namespace ${namespace}`;
}
