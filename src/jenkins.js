import "zx/globals";

export async function processJenkinsfile() {
  const jenkinsFile = (await fs.readFile('Jenkinsfile_CNP', 'utf8')).replaceAll("'", '"');
  const type = jenkinsFile.match(/def type = "(.*?)"/)[1];
  const product = jenkinsFile.match(/def product = "(.*?)"/)[1];
  const component = jenkinsFile.match(/def component = "(.*?)"/)[1];

  return { product, component, type, jenkinsFile };
}
