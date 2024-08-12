
export async function createMirrordConfig(namespace, releaseName, type) {
  try {
    const podName = (await $({quiet: true})`kubectl get pods -n ${namespace} -l app.kubernetes.io/name=${releaseName}-${type} -o jsonpath='{.items[0].metadata.name}'`.text()).trim();
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

    console.log('Creating .mirrord/mirrord.json config...');
    await fs.writeJson('.mirrord/mirrord.json', mirrordConfig, { spaces: 2 });
  }
  catch (e) {
    console.log(`Could not find pod of type ${type} for ${releaseName} in namespace ${namespace}. Is this a ccd-definition repository?`);
  }

}
