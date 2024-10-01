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
    return { msg: "Record successfully created!", record: await this.records.readOne({ _id }) };
  }

  async getRecords() {
    return await this.records.readMany({}, { sort: { _id: -1 } });
  }

  async getByUser(user: ObjectId) {
    return await this.records.readMany({ user: user });
  }

  async getByAction(action: String) {
    return await this.records.readMany({ action: action });
  }

  async delete(_id: ObjectId) {
    await this.records.deleteOne({ _id });
    return { msg: "Record deleted successfully!" };
  }

  async assertRecorderIsUser(_id: ObjectId, user: ObjectId) {
    const record = await this.records.readOne({ _id });
    if (record != null && record.user !== user) {
      throw new NotAllowedError("You are not allowed to delete this record.");
    }
  }
}

export class RecorderNotMatchError extends NotAllowedError {
  constructor(
    public readonly recorder: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the recorder of record {1}!", recorder, _id);
  }
}

  
