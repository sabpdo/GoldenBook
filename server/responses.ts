import { Authing } from "./app";
import { AlreadyFriendsError, FriendNotFoundError, FriendRequestAlreadyExistsError, FriendRequestDoc, FriendRequestNotFoundError } from "./concepts/friending";
import { PostAuthorNotMatchError, PostDoc } from "./concepts/posting";
import { MessageSenderNotMatchError, MessageDoc } from "./concepts/messaging";
import { NudgeSenderNotMatchError, NudgeDoc } from "./concepts/nudging";
import { RecorderNotMatchError, RecordDoc } from "./concepts/recording";
import { Router } from "./framework/router";

/**
 * This class does useful conversions for the frontend.
 * For example, it converts a {@link PostDoc} into a more readable format for the frontend.
 */
export default class Responses {
  /**
   * Convert PostDoc into more readable format for the frontend by converting the author id into a username.
   */
  static async post(post: PostDoc | null) {
    if (!post) {
      return post;
    }
    const author = await Authing.getUserById(post.author);
    return { ...post, author: author.username };
  }

  /**
   * Same as {@link post} but for an array of PostDoc for improved performance.
   */
  static async posts(posts: PostDoc[]) {
    const authors = await Authing.idsToUsernames(posts.map((post) => post.author));
    return posts.map((post, i) => ({ ...post, author: authors[i] }));
  }

  /**
   * Convert FriendRequestDoc into more readable format for the frontend
   * by converting the ids into usernames.
   */
  static async friendRequests(requests: FriendRequestDoc[]) {
    const from = requests.map((request) => request.from);
    const to = requests.map((request) => request.to);
    const usernames = await Authing.idsToUsernames(from.concat(to));
    return requests.map((request, i) => ({ ...request, from: usernames[i], to: usernames[i + requests.length] }));
  }

  /**
   * Convert MessageDoc into more readable format for the frontend by converting the sender/receiver id into a username.
   */
  static async message(message: MessageDoc | null) {
    if (!message) {
      return message;
    }
    const sender = await Authing.getUserById(message.from);
    const receiver = await Authing.getUserById(message.to);
    return { ...message, to: receiver.username, from: sender.username };
  }

  /**
   * Same as {@link message} but for an array of MessageDoc for improved performance.
   */
  static async messages(messages: MessageDoc[]) {
    const senders = await Authing.idsToUsernames(messages.map((message) => message.from));
    const receivers = await Authing.idsToUsernames(messages.map((message) => message.to));
    return messages.map((message, i) => ({ ...message, from: senders[i], to: receivers[i] }));
  }

  static async nudge(nudge: NudgeDoc | null) {
    if (!nudge) {
      return nudge;
    }
    if (!nudge.from) {
      return { ...nudge, from: "SYSTEM" };
    }
    const receiver = await Authing.getUserById(nudge.to);
    if (!nudge.from) {
      return { ...nudge, to: receiver.username, from: "SYSTEM" };
    }
    const sender = await Authing.getUserById(nudge.from);
    return { ...nudge, to: receiver.username, from: sender.username };
  }

  /**
   * Same as {@link nudge} but for an array of NudgeDoc for improved performance.
   */
  static async nudges(nudges: NudgeDoc[]) {
    const senders = Array<string|null>();
    for (let i = 0; i < nudges.length; i++) {
      const nudge_sender = nudges[i].from;
      if (nudge_sender) {
        senders.push(null);
      } else if (nudge_sender) {
        const sender = (await Authing.getUserById(nudge_sender)).username;
        senders.push(sender);
      }
    }
    const receivers = await Authing.idsToUsernames(nudges.map((nudge) => nudge.to));
    return nudges.map((nudge, i) => ({ ...nudge, from: senders[i], to: receivers[i] }));
  }

  static async record(record: RecordDoc | null) {
    if (!record) {
      return record;
    }
    const recorder = await Authing.getUserById(record.user);
    return { ...record, recorder: recorder.username };
  }

  static async records(records: RecordDoc[]) {
    const recorders = await Authing.idsToUsernames(records.map((record) => record.user));
    return records.map((record, i) => ({ ...record, recorder: recorders[i] }));
  }
}

Router.registerError(PostAuthorNotMatchError, async (e) => {
  const username = (await Authing.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(FriendRequestAlreadyExistsError, async (e) => {
  const [user1, user2] = await Promise.all([Authing.getUserById(e.from), Authing.getUserById(e.to)]);
  return e.formatWith(user1.username, user2.username);
});

Router.registerError(FriendNotFoundError, async (e) => {
  const [user1, user2] = await Promise.all([Authing.getUserById(e.user1), Authing.getUserById(e.user2)]);
  return e.formatWith(user1.username, user2.username);
});

Router.registerError(FriendRequestNotFoundError, async (e) => {
  const [user1, user2] = await Promise.all([Authing.getUserById(e.from), Authing.getUserById(e.to)]);
  return e.formatWith(user1.username, user2.username);
});

Router.registerError(AlreadyFriendsError, async (e) => {
  const [user1, user2] = await Promise.all([Authing.getUserById(e.user1), Authing.getUserById(e.user2)]);
  return e.formatWith(user1.username, user2.username);
});

Router.registerError(MessageSenderNotMatchError, async (e) => {
  const username = (await Authing.getUserById(e.sender)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(NudgeSenderNotMatchError, async (e) => {
  const username = (await Authing.getUserById(e.sender)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(RecorderNotMatchError, async (e) => {
  const username = (await Authing.getUserById(e.recorder)).username;
  return e.formatWith(username, e._id);
});