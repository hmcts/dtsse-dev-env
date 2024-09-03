#!/usr/bin/env node

import "zx/globals";
import { deploy } from "./deployment/deploy.mjs";
import { deleteDeployment } from "./deployment/delete.mjs";
import { checkPrerequisites, ensurePreviewChartExists } from "./deployment/prerequisites.mjs";
import { processJenkinsfile } from "./deployment/jenkins.mjs";
import { importCcdDefinition } from "./ccd/import.mjs";

await checkPrerequisites();

const { product, component, type, jenkinsFile } = await processJenkinsfile();
const user = (await $`whoami`.text()).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8);
const namespace = product;
const chartName = product + '-' + component;
await ensurePreviewChartExists(product, component, argv.template);

if (argv.delete) {
  await deleteDeployment(chartName, user, namespace);
} else if (argv['import-ccd']) {
  await importCcdDefinition(argv['import-ccd']);
} else {
  await deploy(product, component, type, user, namespace, chartName, jenkinsFile, argv.template);
}

