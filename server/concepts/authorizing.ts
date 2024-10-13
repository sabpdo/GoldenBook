import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "./errors";

export interface AuthorizationDoc extends BaseDoc {
  user: ObjectId;
  denied_action: String;
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
    const denied = await this.denied_actions.readOne({ user: user, action: action });
    if (!denied) {
      throw new AlreadyAllowedError(user, action);
    }
    await this.denied_actions.deleteMany({ user: user, action: action });
    return { msg: "Action successfully allowed!", user: user, action: action };
  }

  async deny(user: ObjectId, action: String) {
    const denied = await this.denied_actions.readOne({ user: user, action: action });
    if (denied) {
      throw new AlreadyDeniedError(user, action);
    }
    const _id = await this.denied_actions.createOne({ user, denied_action: action });
    return { msg: "Action successfully denied!", authorization: await this.denied_actions.readOne({ _id }) };
  }

  async addAuthorizer(authorizer: ObjectId, authorizee: ObjectId) {
    const userMap = this.user_control_map.get(authorizer);
    if (this.user_control_map.has(authorizer) && userMap != undefined && userMap.has(authorizee)) {
      throw new AuthorizerAlreadyExistsError(authorizer, authorizee);
    }
    if (!userMap) {
      this.user_control_map.set(authorizer, new Set([authorizee]));
    } else {
      userMap.add(authorizee);
    }
    return { msg: "Control successfully given!", authorizer: authorizer, authorizee: authorizee };
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

  async getAuthorizeesByAuthorizer(authorizer: ObjectId) {
    const userMap = this.user_control_map.get(authorizer);
    if (!this.user_control_map.has(authorizer) || (userMap != undefined && userMap.size == 0)) {
      throw new AuthorizerDoesNotExistError(authorizer);
    } else if (this.user_control_map.has(authorizer) && userMap != undefined) {
      return Array.from(userMap);
    }
  }

  async getAuthorizersByAuthorizee(authorizee: ObjectId) {
    const authorizers = Array.from(this.user_control_map.keys()).filter((authorizer) => {
      const userMap = this.user_control_map.get(authorizer);
      return this.user_control_map.has(authorizer) && userMap != undefined && userMap.has(authorizee);
    });
    if (authorizers.length == 0) {
      throw new NotFoundError("No authorizers found!");
    } else {
      return authorizers;
    }
  }

  async assertIsAuthorizer(authorizer: ObjectId, authorizee: ObjectId) {
    const userMap = this.user_control_map.get(authorizer);

    if (!this.user_control_map.has(authorizer) || (userMap != undefined && !userMap.has(authorizer))) {
      throw new AuthorizerPermissionError(authorizer, authorizee);
    }
  }

  async assertActionIsAllowed(user: ObjectId, action: String) {
    const denied = await this.denied_actions.readOne({ user: user, action: action });
    if (denied) {
      throw new UnauthorizedActionError(user, action);
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

export class AuthorizerPermissionError extends NotAllowedError {
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

export class AlreadyAllowedError extends NotAllowedError {
  constructor(
    public readonly authorizee: ObjectId,
    public readonly action: String,
  ) {
    super("Action {0} already is allowed for user {1}!", action, authorizee);
  }
}

export class AlreadyDeniedError extends NotAllowedError {
  constructor(
    public readonly authorizee: ObjectId,
    public readonly action: String,
  ) {
    super("Action {0} already is denied for user {1}!", action, authorizee);
  }
}

export class AuthorizerAlreadyExistsError extends NotAllowedError {
  constructor(
    public readonly authorizer: ObjectId,
    public readonly authorizee: ObjectId,
  ) {
    super("{0} already has authorization permission access over {1}!", authorizer, authorizee);
  }
}

export class AuthorizerDoesNotExistError extends NotFoundError {
  constructor(public readonly authorizer: ObjectId) {
    super("Authorizer {0} does not exist!", authorizer);
  }
}
