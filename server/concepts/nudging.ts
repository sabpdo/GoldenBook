import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "./errors";

export interface NudgeDoc extends BaseDoc {
  action: String;
  time: Date;
  to: ObjectId;
  from: ObjectId;
}

/**
 * concept: Nudging [User, Action]
 */
export default class NudgingConcept {
  public readonly nudges: DocCollection<NudgeDoc>;

  /**
   * Make an instance of Nudging.
   */
  constructor(collectionName: string) {
    this.nudges = new DocCollection<NudgeDoc>(collectionName);
  }

  async create(action: string, time: Date, to: ObjectId, from?: ObjectId) {
    if (time < new Date()) {
      throw new BadValuesError("Time must be now or in the future!");
    }
    let _id;
    if (from) {
      _id = await this.nudges.createOne({ to, from, action, time });
    } else {
      _id = await this.nudges.createOne({ to, action, time });
    }
    return { msg: "Nudge successfully created!", nudge: await this.nudges.readOne({ _id }) };
  }

  /**
   * Creates many nudges for the future starting from the start date to the end date with the given frequency.
   * @param action  action to be performed
   * @param start date to start nudging, must be now or in the future
   * @param end  date to stop nudging, must be in the future, end > start
   * @param frequency how often the nudge should be sent in integer days, must be greater than 0
   */
  async createMany(action: string, start: Date, end: Date, frequency: number, to: ObjectId, from: ObjectId) {
    if (start < new Date()) {
      throw new BadValuesError("Start date must be now or in the future!");
    }
    if (end < start) {
      throw new BadValuesError("End date must be in the future and later than start date!");
    }
    if (frequency < 1 || !Number.isInteger(frequency)) {
      throw new BadValuesError("Frequency must be an integer greater than 0!");
    }
    let time = new Date(start);
    const nudge_ids = [];
    while (time < end) {
      time = new Date(time);
      if (time > end) break;
      const nudge = this.nudges.createOne({ action, time, to, from });
      nudge_ids.push(nudge);
      time.setDate(time.getDate() + frequency);
    }

    const nudges = await this.nudges.readMany({ _id: { $in: await Promise.all(nudge_ids) } });
    return { msg: "Nudges successfully created!", nudges: nudges };
  }

  async getNudges() {
    return await this.nudges.readMany({}, { sort: { _id: -1 } });
  }

  async getFutureNudges(time?: Date) {
    if (time == undefined) {
      time = new Date();
    }
    return await this.nudges.readMany({ time: { $gt: time } }, { sort: { time: 1 } });
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
    if (nudge.from && nudge.from.toString() != user.toString()) {
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
