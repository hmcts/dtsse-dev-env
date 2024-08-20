
export async function checkPrerequisites() {
  await Promise.all([
    ensureHelmInstalled(),
    ensureAzureCliInstalled(),
    ensureAzureCliLoggedIn(),
    ensureJenkinsFileExists()
  ]);
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

async function ensureJenkinsFileExists() {
  if (!(await fs.exists('Jenkinsfile_CNP'))) {
    console.error('Jenkinsfile_CNP not found. Ensure that you run this from the root of the repository.');
    process.exit(1);
  }
}

export async function ensurePreviewChartExists(product, component, template) {
  if (!await fs.exists(`charts/${product}-${component}/Chart.yaml`)) {
    console.error(`Chart not found. Ensure that you have a chart at charts/${product}-${component}/Chart.yaml.`);
    process.exit(1);
  }

  if (!await fs.exists(`charts/${product}-${component}/values.preview.template.yaml`)) {
    console.error(`Preview template not found. Ensure it's located in charts/${product}-${component}/values.preview.template.yaml.`);
    process.exit(1);
  }

  if (template && !await fs.exists(template)) {
    console.error(`Additional template not found: ${template}.`);
    process.exit(1);
  }
}
