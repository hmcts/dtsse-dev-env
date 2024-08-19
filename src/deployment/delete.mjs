
export async function deleteDeployment(chartName, user, namespace) {
  console.log('Deleting helm chart...');
  await $`helm uninstall ${chartName}-dev-pr-0-${user} --namespace ${namespace}`;
}
