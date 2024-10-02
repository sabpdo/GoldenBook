import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Friending, Posting, Sessioning, Messaging, Authorizing, Nudging, Recording } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }

  @Router.get("/messages")
  @Router.validate(z.object({ sender: z.string().optional(), receiver: z.string().optional() }))
  async getMessages(sender?: string, receiver?: string) {
    let messages;
    if (sender && receiver) {
      const sender_id = (await Authing.getUserByUsername(sender))._id;
      const receiver_id = (await Authing.getUserByUsername(receiver))._id;
      messages = await Messaging.getBySenderAndReceiver(sender_id, receiver_id);
    }  else if (sender) {
      const id = (await Authing.getUserByUsername(sender))._id;
      messages = await Messaging.getBySender(id);
    } else if (receiver) {
      const id = (await Authing.getUserByUsername(receiver))._id;
      messages = await Messaging.getByReceiver(id);
    } else {
      messages = await Messaging.getMessages();
    }
    return Responses.messages(messages);
  }

  @Router.post("/messages")
  async sendMessage(session: SessionDoc, to: string, content: string) {
    const receiver = (await Authing.getUserByUsername(to))._id;
    const sender = Sessioning.getUser(session);
    const created = await Messaging.create(sender, receiver, content);
    return { msg: created.msg, message: Responses.message(created.message) };
  }

  @Router.delete("/messages/:id")
  async deleteMessage(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Messaging.assertSenderIsUser(oid, user);
    return Messaging.delete(oid);
  }

  @Router.get("/nudges")
  @Router.validate(z.object({ sender: z.string().optional(), receiver: z.string().optional(), action: z.string().optional(), time: z.string().optional() }))
  async getNudges(sender?: string, receiver?: string, action?: string, time?: string) {
    let nudges;
    if (sender) {
      const id = (await Authing.getUserByUsername(sender))._id;
      nudges = await Nudging.getBySender(id);
    } else if (receiver) {
      const id = (await Authing.getUserByUsername(receiver))._id;
      nudges = await Nudging.getByReceiver(id);
    } else if (time) {
      const timeDate = time ? new Date(time) : new Date();
      nudges = await Nudging.getFutureNudges(timeDate);
    } else {
      nudges = await Nudging.getNudges();
    }
    return Responses.nudges(nudges);
  }

  @Router.post("/nudges")
  async sendNudge(session: SessionDoc, to: string, action: string, time?: string) {
    const receiver = (await Authing.getUserByUsername(to))._id;
    const sender = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    const created = await Nudging.create(action, timeDate, receiver, sender);
    return { msg: created.msg, message: Responses.nudge(created.nudge) };
  }

  @Router.delete("/nudges/:id")
  async deleteNudge(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Nudging.assertSenderIsUser(oid, user);
    return Nudging.delete(oid);
  }

  @Router.get("/records")
  @Router.validate(z.object({ recorder: z.string().optional() }))
  async getRecords(recorder?: string) {
    let records;
    if (recorder) {
      const id = (await Authing.getUserByUsername(recorder))._id;
      records = await Recording.getByUser(id);
    } else {
      records = await Recording.getRecords();
    }
    return Responses.records(records);
  }

  @Router.post("/records")
  async createRecord(session: SessionDoc, action: string, time?: string) {
    const user = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    const created = await Recording.create(user, action, timeDate);
    return { msg: created.msg, record: Responses.record(created.record) };
  }

  @Router.delete("/records/:id")
  async deleteRecord(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Recording.assertRecorderIsUser(oid, user);
    return Recording.delete(oid);
  }

  @Router.get("/authorize")
  async getDeniedActions(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authorizing.getDeniedActionByUser(user);
  }

  @Router.post("/authorize/allow")
  async authorizeAction(session: SessionDoc, action: string, username: string) {
    const user = (await Authing.getUserByUsername(username))._id;
    return await Authorizing.allow(user, action);
  }

  @Router.post("/authorize/deny")
  async denyAction(session: SessionDoc, action: string, username: string) {
    const user = (await Authing.getUserByUsername(username))._id;
    return await Authorizing.deny(user, action);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
