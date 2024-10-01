import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface NudgeDoc extends BaseDoc {
  to: ObjectId;
  from: ObjectId | null;
  action: String;
  time?: Date;
}

/**
 * concept: Nudging [Action, User]
 */
export default class NudgingConcept {
  public readonly nudges: DocCollection<NudgeDoc>;

  /**
   * Make an instance of Nudging.
   */
  constructor(collectionName: string) {
    this.nudges = new DocCollection<NudgeDoc>(collectionName);
  }

  async create(to: ObjectId, from: ObjectId | null = null, action: string, time?: Date) {
    time = (time == undefined) ? new Date() : time;
    const _id = await this.nudges.createOne({ to, from, action, time });
    return { msg: "Nudge successfully created!", nudge: await this.nudges.readOne({ _id }) };
  }

  async getNudges() {
    return await this.nudges.readMany({}, { sort: { _id: -1 } });
  }

  async getFutureNudges(time: Date) {
    return await this.nudges.readMany({ time: { $gt: new Date() } }, { sort: { time: 1 } });
  }

  async getBySender(to?: ObjectId, from?: ObjectId) {
    return await this.nudges.readMany({ to: to, from: from });
  }

  async getByReceiver(to: ObjectId) {
    return await this.nudges.readMany({ to: to });
  }

  async delete(_id: ObjectId) {
    await this.nudges.deleteOne({ _id });
    return { msg: "Nudge deleted successfully!" };
  }

  async assertSenderIsUser(_id: ObjectId, user: ObjectId) {
    const nudge = await this.nudges.readOne({ _id });
    if (!nudge) {
      throw new NotFoundError(`Nudge ${_id} does not exist!`);
    }
    if (nudge.from !== null && nudge.from.toString() !== user.toString()) {
      throw new NudgeSenderNotMatchError(user, _id);
    }
  }
}

export class NudgeSenderNotMatchError extends NotAllowedError {
  constructor(
    public readonly sender: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the sender of nudge {1}!", sender, _id);
  }
}

  
