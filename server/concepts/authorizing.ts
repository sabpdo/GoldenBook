import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "./errors";

type DeniedAction = "Message"|"Friend"|"Nudge"|"Record"|"Post";

export interface AuthorizationDoc extends BaseDoc {
  user : ObjectId;
  action: DeniedAction;
}

/**
 * concept: Authorizing [User, Action]
 */
export default class AuthorizingConcept {
  public readonly denied_actions: DocCollection<AuthorizationDoc>;
  public readonly user_control_map: Map<ObjectId, Set<ObjectId>>;

  /**
   * Make an instance of Authorizing.
   */
  constructor(collectionName: string) {
    this.denied_actions = new DocCollection<AuthorizationDoc>(collectionName);
    this.user_control_map = new Map();
  }

  async allow(user: ObjectId, action: String) {
    const denied_action = action as DeniedAction;
    const _id = await this.denied_actions.deleteMany({ user: user, action: denied_action });
    return { msg: "Action successfully allowed!", allowed: await this.denied_actions.readOne({ _id }) };
  }

  async deny(user: ObjectId, action: String) {
    const denied_action = action as DeniedAction;
    const _id = await this.denied_actions.createOne({ user, action: denied_action });
    return { msg: "Action successfully denied!", denied: await this.denied_actions.readOne({ _id }) };
  }

  async addAuthorizer(authorizer: ObjectId, authorizee: ObjectId) {
    const userMap = this.user_control_map.get(authorizer);
    if (!userMap) {
      this.user_control_map.set(authorizer, new Set([authorizee]));
    } else {
      userMap.add(authorizee);
    }
    return { msg: "Control successfully given!" };
  }

  async removeAuthorizer(authorizer: ObjectId, authorizee: ObjectId) {
    const userMap = this.user_control_map.get(authorizer);
    if (!this.user_control_map.has(authorizer) || (userMap != undefined && !userMap.has(authorizee))) {
      throw new AuthorizerNotFoundError(authorizer, authorizee);
    } else if (this.user_control_map.has(authorizer) && userMap != undefined) {
      userMap.delete(authorizee);
    }
    return { msg: "Control successfully revoked!" };
  }

  async getDeniedActionByUser(user: ObjectId) {
    return await this.denied_actions.readMany({ user: user });
  }

  async assertIsAuthorizer(authorizer: ObjectId, authorizee: ObjectId) {
    const userMap = this.user_control_map.get(authorizer);
  
    if (!this.user_control_map.has(authorizer) || (userMap != undefined && !userMap.has(authorizer))) {
      throw new AuthorizerError(authorizer, authorizee);
    }
  }

  async assertActionIsAllowed(user: ObjectId, action: String) {
    const denied_ation = action as DeniedAction;
    const denied = await this.denied_actions.readOne({ user: user, action: denied_ation });
    if (denied) {
      throw new UnauthorizedActionError(user, action);
    }
  }

  async assertIsValidAction(action: String) {
    const validActions: DeniedAction[] = ["Message", "Friend", "Nudge", "Record", "Post"];
  
    if (!validActions.includes(action as DeniedAction)) {
      throw new InvalidActionError("Invalid action!");
    }
  }
}

export class UnauthorizedActionError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly action: String,
  ) {
    super("{0} is not allowed to perform action {1}!", user, action);
  }
}

export class InvalidActionError extends BadValuesError {
  constructor(
    public readonly action: String,
  ) {
    super("{0} is an invalid action to authorize!", action);
  }
}

export class AuthorizerError extends NotAllowedError {
  constructor(
    public readonly authorizer: ObjectId,
    public readonly authorizee: ObjectId,
  ) {
    super("{0} does not have authorization access over {1}!", authorizer, authorizee);
  }
}

export class AuthorizerNotFoundError extends NotFoundError {
  constructor(
    public readonly authorizer: ObjectId,
    public readonly authorizee: ObjectId,
  ) {
    super("Authorization from {0} to {1} does not exist!", authorizer, authorizee);
  }
}