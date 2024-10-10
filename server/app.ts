import AuthenticatingConcept from "./concepts/authenticating";
import FriendingConcept from "./concepts/friending";
import PostingConcept from "./concepts/posting";
import SessioningConcept from "./concepts/sessioning";
import MessagingConcept from "./concepts/messaging";
import NudgingConcept from "./concepts/nudging";
import AuthorizingConcept from "./concepts/authorizing";
import RecordingConcept from "./concepts/recording";

// The app is a composition of concepts instantiated here
// and synchronized together in `routes.ts`.
export const Sessioning = new SessioningConcept();
export const Authing = new AuthenticatingConcept("users");
export const Posting = new PostingConcept("posts");
export const Friending = new FriendingConcept("friends");
export const Messaging = new MessagingConcept("messages");
export const Nudging = new NudgingConcept("nudges");
export const Authorizing = new AuthorizingConcept("authorizations");
export const Recording = new RecordingConcept("recordings");