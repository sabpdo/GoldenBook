import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface RecordDoc extends BaseDoc {
  user: ObjectId;
  action: String;
  time: Date;
}

/**
 * concept: Recording [Action]
 */
export default class RecordingConcept {
  public readonly records: DocCollection<RecordDoc>;

  /**
   * Make an instance of Recording.
   */
  constructor(collectionName: string) {
    this.records = new DocCollection<RecordDoc>(collectionName);
  }

  async create(user: ObjectId, action: string, time: Date) {
    const _id = await this.records.createOne({ user, action, time });
    return { msg: "Record successfully created!", post: await this.records.readOne({ _id }) };
  }

  async getRecords() {
    return await this.records.readMany({}, { sort: { _id: -1 } });
  }

  async getByUser(user: ObjectId) {
    return await this.records.readMany({ user: user });
  }

  async getByTime(time: Date) {
    return await this.records.readMany({ time: time });
  }

  async getByAction(action: String) {
    return await this.records.readMany({ action: action });
  }

  async delete(_id: ObjectId) {
    await this.records.deleteOne({ _id });
    return { msg: "Record deleted successfully!" };
  }
}

  
