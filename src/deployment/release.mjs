
export function getReleaseName(chartName, user) {
  return `${chartName}-${user}`;
}

export function getFqfn(releaseName) {
  return `${releaseName}-pr-1.preview.platform.hmcts.net`;
}
