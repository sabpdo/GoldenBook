import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface RecordDoc extends BaseDoc {
  user: ObjectId;
  action: String;
  time: Date;
}

/**
 * concept: Recording [User, Action]
 */
export default class RecordingConcept {
  public readonly records: DocCollection<RecordDoc>;
  public readonly autotracked_records: Map<ObjectId, Set<string>>;

  /**
   * Make an instance of Recording.
   */
  constructor(collectionName: string) {
    this.records = new DocCollection<RecordDoc>(collectionName);
    this.autotracked_records = new Map();
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
  
  /**
   *  Determines if the action is automatic.
   */
  async isAutomatic(user: ObjectId, action: string) {
    const user_tracked_actions = this.autotracked_records.get(user);
    return (user_tracked_actions) ? user_tracked_actions.has(action) : false;
  }  

  /**
   *  Starts automatic recording of the given action.
   */
  async startAutomaticRecording(user: ObjectId, action: string) {
    let user_tracked_actions = this.autotracked_records.get(user);
    if (!user_tracked_actions) {
      user_tracked_actions = new Set();
      this.autotracked_records.set(user, user_tracked_actions);
    }
    user_tracked_actions.add(action);
    return { msg: "Automatic recording started!", user: user, action: action };
  }

  /**
   *  Stops automatic recording of the given action.
   */
  async stopAutomaticRecording(user: ObjectId, action: string) {
    const user_tracked_actions = this.autotracked_records.get(user);
    if (user_tracked_actions) {
      user_tracked_actions.delete(action);
    }
    return { msg: "Automatic recording stopping!", user: user, action: action };
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

  
