import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface MessageDoc extends BaseDoc {
  to: ObjectId;
  from: ObjectId;
  content: string;
  time: Date;
}

/**
 * concept: Messaging [User]
 */
export default class MessagingConcept {
  public readonly messages: DocCollection<MessageDoc>;

  /**
   * Make an instance of Messaging.
   */
  constructor(collectionName: string) {
    this.messages = new DocCollection<MessageDoc>(collectionName);
  }

  async create(to: ObjectId, from: ObjectId, content: string) {
    const time = new Date();
    const _id = await this.messages.createOne({ to, from, content, time });
    return { msg: "Message successfully created!", message: await this.messages.readOne({ _id }) };
  }

  async getMessages() {
    return await this.messages.readMany({}, { sort: { _id: -1 } });
  }

  async getBySender(from: ObjectId) {
    return await this.messages.readMany({ from: from });
  }

  async getByReceiver(to: ObjectId) {
    return await this.messages.readMany({ to: to });
  }

  async getBySenderAndReceiver(from: ObjectId, to: ObjectId) {
    return await this.messages.readMany({ from: from, to: to });
  }

  async delete(_id: ObjectId) {
    await this.messages.deleteOne({ _id });
    return { msg: "Message deleted successfully!" };
  }

  async assertSenderIsUser(_id: ObjectId, user: ObjectId) {
    const message = await this.messages.readOne({ _id });
    if (!message) {
      throw new NotFoundError(`Message ${_id} does not exist!`);
    }
    if (message.from.toString() !== user.toString()) {
      throw new MessageSenderNotMatchError(user, _id);
    }
  }
}

export class MessageSenderNotMatchError extends NotAllowedError {
  constructor(
    public readonly sender: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the sender of message {1}!", sender, _id);
  }
}
