#!/usr/bin/env node

import "zx/globals";
import { deploy } from "./deploy.js";
import { deleteDeployment } from "./delete.js";
import { checkPrerequisites, ensurePreviewChartExists } from "./prerequisites.js";
import { processJenkinsfile } from "./jenkins.js";

await checkPrerequisites();

const { product, component, type, jenkinsFile } = await processJenkinsfile();
const user = (await $`whoami`.text()).trim();
const namespace = product;
const chartName = product + '-' + component;
const chartFilename = await ensurePreviewChartExists(product, component, argv.template);

if (argv.delete) {
  await deleteDeployment(chartName, user, namespace);
} else {
  await deploy(product, component, type, user, namespace, chartName, jenkinsFile, chartFilename);
}

