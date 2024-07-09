
export async function createMirrordConfig(namespace, chartName, user, type) {
  console.log('Creating .mirrord/mirrord.json config...');
  const podName = (await $`kubectl get pods -n ${namespace} -l app.kubernetes.io/name=${chartName}-dev-${user}-${type} -o jsonpath='{.items[0].metadata.name}'`.text()).trim();
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
