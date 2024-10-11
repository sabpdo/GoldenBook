import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface RecordDoc extends BaseDoc {
  user: ObjectId;
  action: String;
  time: Date;
  automatic: Boolean;
}

/**
 * concept: Recording [User, Action]
 */
export default class RecordingConcept {
  public readonly records: DocCollection<RecordDoc>;

  /**
   * Make an instance of Recording.
   */
  constructor(collectionName: string) {
    this.records = new DocCollection<RecordDoc>(collectionName);
  }

  async create(user: ObjectId, action: string, time: Date, automatic: Boolean) {
    const _id = await this.records.createOne({ user, action, time, automatic });
    return { msg: "Record successfully created!", record: await this.records.readOne({ _id }) };
  }

  /**
   * Gets all records.
   */
  async getRecords() {
    return await this.records.readMany({}, { sort: { _id: -1 } });
  }

  /**
   *  Gets all records with the given user.
   */
  async getByUser(user: ObjectId) {
    return await this.records.readMany({ user: user });
  }

  /**
   * Gets all records with the given action.
   */
  async getByAction(action: String) {
    return await this.records.readMany({ action: action });
  }
  
  /**
   *  Determines if the action is automatic, based off the status of the most recent record.
   */
  async isAutomatic(action: String) {
    const records = await this.records.readMany({action}, {sort: { time: -1 }});
  
    if (records == null) {
      throw new NotFoundError("Record not found.");
    }
    return records[0].automatic;
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

  
