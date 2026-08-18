/** Client-safe auth barrel — do not re-export server actions here. */

export {
  AUTH_PUBLIC_PATHS,
  DEFAULT_AUTH_REDIRECT,
  isAuthPublicPath,
  MIN_PASSWORD_LENGTH,
} from "./constants"
export { toFriendlyAuthError } from "./errors"
export {
  authCallbackUrlWithNext,
  authHrefWithNext,
  parseSafeAuthNext,
  resolveSafeAuthNext,
} from "./safe-next"
export {
  createProfile,
  ensureAuthenticatedProfile,
  ensureProfile,
  fetchProfile,
  greetingName,
  updateProfile,
} from "./profile"
export type {
  AuthActionResult,
  LoginInput,
  Profile,
  RegisterInput,
  ThemePreference,
  UnitsPreference,
} from "./types"
