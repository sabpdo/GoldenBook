import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface AuthorizationDoc extends BaseDoc {
  user : ObjectId;
  denied: String;
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
    const _id = await this.denied.deleteMany({ user: user, denied: action });
    return { msg: "Action successfully allowed!", post: await this.denied.readOne({ _id }) };
  }

  async deny(user: ObjectId, action: String) {
    const _id = await this.denied.createOne({ user, denied: action });
    return { msg: "Action successfully denied!", post: await this.denied.readOne({ _id }) };
  }

  async getDeniedActionByUser(user: ObjectId) {
    return await this.denied.readMany({ user: user });
  }

  async assertIsAllowed(user: ObjectId, action: String) {
    const denied = await this.denied.readOne({ user: user, denied: action });
    if (denied) {
      throw new UnauthorizedError(user, action);
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
