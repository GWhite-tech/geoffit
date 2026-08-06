/**
 * Temporary cloud→store bootstrap bridge.
 * Delete this module when cloud-first hydration (PR4) lands.
 */

export {
  BOOTSTRAP_VERSION,
  clearBootstrapState,
  emptyDomainDebug,
  isBootstrapDisabled,
  readBootstrapState,
  setBootstrapDisabled,
  writeBootstrapState,
} from "./bootstrap-state"
export type {
  BootstrapDomainDebug,
  BootstrapDomainResult,
  BootstrapState,
} from "./bootstrap-state"
export { scheduleCloudBootstrap } from "./cloud-bootstrap"
