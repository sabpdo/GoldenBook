import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface AuthorizedDoc extends BaseDoc {
    user : ObjectId;
    denied: String;
}

/**
 * concept: Authorizing [User, Action]
 */
export default class AuthorizingConcept {
  public readonly denied: DocCollection<AuthorizedDoc>;

  /**
   * Make an instance of Authorizing.
   */
  constructor(collectionName: string) {
    this.denied = new DocCollection<AuthorizedDoc>(collectionName);
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

    async getByAction(action: String) {
        return await this.denied.readMany({ denied: action });
    }

    async isAllowed(user: ObjectId, action: String) {
        const denied = await this.denied.readOne({ user: user, denied: action });
        return !denied;
    }
}
