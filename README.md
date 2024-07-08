# CFT Dev Environment

This package will use Helm to deploy a development environment based on the Preview chart. It will automatically create a mirrord.json configuration to connect your local application to the deployed environment.

## Prerequisites

- [Helm](https://helm.sh/docs/intro/install/)
- [AZ CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
- [Node.js](https://nodejs.org/en/download/)

## Usage

```bash
npx @hmcts/dev-dev
```

Run the command from your project root directory. The script will check for a Helm chart and Jenkinsfile.

To clean up the environment, run:

```bash
npx @hmcts/dev-dev --destroy
```
