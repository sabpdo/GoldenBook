import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

type DeniedAction = "Message"|"Friend"|"Nudge"|"Record"|"Post";

export interface AuthorizationDoc extends BaseDoc {
  user : ObjectId;
  action: DeniedAction;
}

/**
 * concept: Authorizing [User, Action]
 */
export default class AuthorizingConcept {
  public readonly denied: DocCollection<AuthorizationDoc>;

  /**
   * Make an instance of Authorizing.
   */
  constructor(collectionName: string) {
    this.denied = new DocCollection<AuthorizationDoc>(collectionName);
  }

  async allow(user: ObjectId, action: String) {
    const denied_action = action as DeniedAction;
    const _id = await this.denied.deleteMany({ user: user, action: denied_action });
    return { msg: "Action successfully allowed!", allowed: await this.denied.readOne({ _id }) };
  }

  async deny(user: ObjectId, action: String) {
    const denied_action = action as DeniedAction;
    const _id = await this.denied.createOne({ user, action: denied_action });
    return { msg: "Action successfully denied!", denied: await this.denied.readOne({ _id }) };
  }

  async getDeniedActionByUser(user: ObjectId) {
    return await this.denied.readMany({ user: user });
  }

  async assertIsAllowed(user: ObjectId, action: String) {
    const denied_ation = action as DeniedAction;
    const denied = await this.denied.readOne({ user: user, action: denied_ation });
    if (denied) {
      throw new UnauthorizedError(user, action);
    }
  }

  async assertIsValidAction(action: String) {
    const validActions: DeniedAction[] = ["Message", "Friend", "Nudge", "Record", "Post"];
  
    if (!validActions.includes(action as DeniedAction)) {
      throw new InvalidActionError("Invalid action!");
    }
  }
}

export class UnauthorizedError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly action: String,
  ) {
    super("{0} is not allowed to perform action {1}!", user, action);
  }
}

export class InvalidActionError extends NotAllowedError {
  constructor(
    public readonly action: String,
  ) {
    super("{0} is an invalid action to authorize!", action);
  }
}
