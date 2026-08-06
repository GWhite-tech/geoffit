/**
 * Temporary cloud→store bootstrap bridge.
 * Delete this module when cloud-first hydration (PR4) lands.
 */

export {
  BOOTSTRAP_VERSION,
  clearBootstrapState,
  isBootstrapDisabled,
  readBootstrapState,
  setBootstrapDisabled,
  writeBootstrapState,
} from "./bootstrap-state"
export { scheduleCloudBootstrap } from "./cloud-bootstrap"
