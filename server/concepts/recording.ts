import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface RecordDoc extends BaseDoc {
  user: ObjectId;
  action: String;
  time: Date;
}

export interface AutomaticRecordDoc extends BaseDoc {
  user: ObjectId;
  autotracked_action: String;
}

/**
 * concept: Recording [User, Action]
 */
export default class RecordingConcept {
  public readonly records: DocCollection<RecordDoc>;
  public readonly autotracked_records: DocCollection<AutomaticRecordDoc>;

  /**
   * Make an instance of Recording.
   */
  constructor(collectionName: string) {
    this.records = new DocCollection<RecordDoc>(collectionName);
    this.autotracked_records = new DocCollection<AutomaticRecordDoc>(collectionName + "_autotracked");
  }

  async create(user: ObjectId, action: string, time: Date) {
    const _id = await this.records.createOne({ user, action, time });
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

  async delete(_id: ObjectId) {
    await this.records.deleteOne({ _id });
    return { msg: "Record deleted successfully!" };
  }

  /**
   *  Determines if the action is automatic.
   */
  async isAutomatic(user: ObjectId, action: string) {
    return (await this.autotracked_records.readOne({ user, action })) != null;
  }

  /**
   *  Starts automatic recording of the given action.
   */
  async startAutomaticRecording(user: ObjectId, autotracked_action: string) {
    if ((await this.autotracked_records.readOne({ user, autotracked_action })) != null) {
      throw new NotAllowedError("Automatic tracking for this action already exists!");
    }

    const _id = await this.autotracked_records.createOne({ user, autotracked_action });
    return { msg: "Automatic tracking successfully started!", automatic_record: await this.autotracked_records.readOne({ _id }) };
  }

  /**
   *  Stops automatic recording of the given action.
   */
  async stopAutomaticRecording(user: ObjectId, autotracked_action: string) {
    if ((await this.autotracked_records.readOne({ user, autotracked_action })) == null) {
      throw new NotAllowedError("Automatic tracking for this action does not already exist!");
    }

    await this.autotracked_records.deleteOne({ user, autotracked_action });
    return { msg: "Automatic tracking successfully stopped!" };
  }

  async assertRecorderIsUser(_id: ObjectId, user: ObjectId) {
    const record = await this.records.readOne({ _id });
    if (record == null) {
      throw new NotFoundError(`Record ${_id} does not exist!`);
    }
    if (record != null && record.user.toString() !== user.toString()) {
      throw new RecorderNotMatchError(user, _id);
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
