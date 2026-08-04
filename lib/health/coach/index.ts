export type {
  CoachTopic,
  CoachCitation,
  CoachAction,
  CoachMessage,
  CoachMessageBlock,
  CoachConversation,
  CoachHealthContext,
  CoachMemorySnapshot,
  CoachPromptBundle,
} from "./types"
export { COACH_SUGGESTED_QUESTIONS, COACH_TOPIC_LABELS } from "./types"
export { buildCoachHealthContext } from "./coach-context-engine"
export { buildCoachMemory } from "./coach-memory"
export { buildCoachPromptBundle } from "./coach-prompt-builder"
export { buildCitationsForContext } from "./coach-citation-engine"
export { buildCoachActions } from "./coach-action-engine"
export {
  generateCoachResponse,
  titleForQuestion,
  detectTopic,
} from "./coach-response-engine"
export {
  getConversationStore,
  resetConversationStore,
  ConversationStore,
} from "./conversation-store"
export { getCoachStore, resetCoachStore, CoachStore } from "./coach-store"
export {
  useCoachBootstrap,
  useCoachContext,
  useCoachConversations,
  useActiveConversation,
  useCoachComposing,
  askCoach,
  selectConversation,
  startNewConversation,
  renameConversation,
  togglePinConversation,
  deleteConversation,
  getSuggestedQuestions,
} from "./use-coach"
