#!/usr/bin/env node

import "zx/globals";
import { deploy } from "./deploy.mjs";
import { deleteDeployment } from "./delete.mjs";
import { checkPrerequisites, ensurePreviewChartExists } from "./prerequisites.mjs";
import { processJenkinsfile } from "./jenkins.mjs";

await checkPrerequisites();

const { product, component, type, jenkinsFile } = await processJenkinsfile();
const user = (await $`whoami`.text()).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const namespace = product;
const chartName = product + '-' + component;
const chartFilename = await ensurePreviewChartExists(product, component, argv.template);

if (argv.delete) {
  await deleteDeployment(chartName, user, namespace);
} else {
  await deploy(product, component, type, user, namespace, chartName, jenkinsFile, chartFilename);
}

