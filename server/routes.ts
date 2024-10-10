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

  /**
    * Creates a post with the given content.
    * 
    * @param session the session of the user, the user must be allowed to post
    * @param content the text of the post
    * @param options customizations of the post, e.g. background color
    * @returns a dictionary with a message and the created post
    */
  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Post");
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  /**
   * Updates a post with the given input.
   * 
   * @param session the session of the user, the user must be allowed to post
   * @param id the post id
   * @param content new text to update the post with
   * @param options new customizations of the post
   * @returns the updated post
   */
  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Authorizing.assertActionIsAllowed(user, "Post");
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  /**
   * Deletes a post with the given id.
   * 
   * @param session the session of the user, the user must be allowed to post
   * @param id the post id
   * @returns a message indicating the success of the deletion
   */
  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Authorizing.assertActionIsAllowed(user, "Post");
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  /**
   * Deletes a friend with the given username for the current session user.
   * 
   * @param session the session of the user, the user must be allowed to friend
   * @param friend the username of the friend to remove, user must exist
   * @returns a message indicating the success of the deletion
   */
  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    await Authorizing.assertActionIsAllowed(user, "Friend");
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  /**
   * Sends a friend request from the current session user to the given username.
   * 
   * @param session the session of the user, the user must be allowed to friend
   * @param to the username of the user to send the request to, user must exist and be allowed to friend
   * @returns a message indicating the success of the request
   */
  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const receiver = (await Authing.getUserByUsername(to))._id;
    await Authorizing.assertActionIsAllowed(user, "Friend");
    await Authorizing.assertActionIsAllowed(receiver, "Friend");
    return await Friending.sendRequest(user, receiver);
  }

  /**
   * Removes a friend request from the current session user to the given username.
   * 
   * @param session the session of the user, the user must be allowed to friend
   * @param to, the username of the user to remove the request to, user must exist and be allowed to friend
   * @returns a message indicating the success of the removal
   */
  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    await Authorizing.assertActionIsAllowed(user, "Friend");
    await Authorizing.assertActionIsAllowed(toOid, "Friend");
    return await Friending.removeRequest(user, toOid);
  }

  /**
   *  Accepts a friend request from the given username.
   * 
   * @param session the session of the user, the user must be allowed to friend
   * @param from  the username of the user to accept the request from, user must exist
   * @returns a message indicating the success of the acceptance
   */
  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    await Authorizing.assertActionIsAllowed(user, "Friend");
    return await Friending.acceptRequest(fromOid, user);
  }

  /**
   * Rejects a friend request from the given username.
   * 
   * @param session the session of the user, the user must be allowed to friend
   * @param from the username of the user to reject the request from, user must exist
   * @returns a message indicating the success of the rejection
   */
  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    await Authorizing.assertActionIsAllowed(user, "Friend");
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

  /**
   *  Sends a message from the current session user to the given username.
   * @param session  the session of the user, the user must be allowed to message
   * @param to the username of the user to send the message to, user must exist and be allowed to message
   * @param content the text of the message
   * @returns a dictionary with the created message
   */
  @Router.post("/messages")
  async sendMessage(session: SessionDoc, to: string, content: string) {
    const receiver = (await Authing.getUserByUsername(to))._id;
    const sender = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(sender, "Message");
    await Authorizing.assertActionIsAllowed(receiver, "Message");
    const created = await Messaging.send(sender, receiver, content);
    return { msg: created.msg, message: Responses.message(created.message) };
  }

  /**
   *  Deletes a message with the given id.
   * 
   * @param session the session of the user, the user must be allowed to message
   * @param id the message id
   * @returns a message indicating the success of the deletion
   */
  @Router.delete("/messages/:id")
  async deleteMessage(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Authorizing.assertActionIsAllowed(user, "Message");
    await Messaging.assertSenderIsUser(oid, user);
    return Messaging.delete(oid);
  }

  @Router.get("/nudges")
  @Router.validate(z.object({ sender: z.string().optional(), receiver: z.string().optional(), time: z.string().optional() }))
  async getNudges(sender?: string, receiver?: string, time?: string) {
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

  /**
   * Sends a nudge from the current session user to the given username.
   * @param session the session of the user, the user must be allowed to nudge
   * @param to the username of the user to send the nudge to, user must exist and be allowed to nudge
   * @param action the text of the nudge action, can be any string
   * @param time the time of the nudge, defaults to the current time
   * @returns a dictionary with the created nudge
   */
  @Router.post("/nudges")
  async sendNudge(session: SessionDoc, to: string, action: string, time?: string) {
    const receiver = (await Authing.getUserByUsername(to))._id;
    const sender = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    await Authorizing.assertActionIsAllowed(sender, "Nudge");
    await Authorizing.assertActionIsAllowed(receiver, "Nudge");
    const created = await Nudging.create(action, timeDate, receiver, sender);
    return { msg: created.msg, message: Responses.nudge(created.nudge) };
  }

  /**
   * Deletes a nudge with the given id.
   * 
   * @param session the session of the user, the user must be allowed to nudge
   * @param id the nudge id
   * @returns a message indicating the success of the deletion
   */
  @Router.delete("/nudges/:id")
  async deleteNudge(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Nudging.assertSenderIsUser(oid, user);
    await Authorizing.assertActionIsAllowed(user, "Nudge");
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

  /**
   * Creates a record with the given action.
   * 
   * @param session the session of the user, the user must be allowed to record
   * @param action the text of the record action
   * @param time the time of the record, defaults to the current time
   * @returns a dictionary with the created record
   */
  @Router.post("/records")
  async createRecord(session: SessionDoc, action: string, time?: string) {
    const user = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    await Authorizing.assertActionIsAllowed(user, "Record");
    const created = await Recording.create(user, action, timeDate);
    return { msg: created.msg, record: Responses.record(created.record) };
  }

  /**
   * Updates a record with the given input.
   * 
   * @param session the session of the user, the user must be allowed to record
   * @param id the record id
   * @param action new text to update the record with
   * @param time new time of the record
   * @returns the updated record
   */
  @Router.delete("/records/:id")
  async deleteRecord(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Recording.assertRecorderIsUser(oid, user);
    return Recording.delete(oid);
  }

  @Router.get("/authorize")
  async getDeniedActions(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authorizing.getDeniedActionByUser(user);
  }

  /**
   * Allows the given username to perform the given action.
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param action the action to allow, must be a valid action ("Message"|"Friend"|"Nudge"|"Record"|"Post")
   * @param username the username to allow the action for
   * @returns  a dictionary with the allowed action
   */
  @Router.post("/authorize/allow")
  async authorizeAction(session: SessionDoc, action: string, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    Authorizing.assertIsValidAction(action);
    return await Authorizing.allow(authorizee, action);
  }

  /**
   * Denies the given username from performing the given action.
   * 
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param action the action to deny, must be a valid action ("Message"|"Friend"|"Nudge"|"Record"|"Post")
   * @param username the username to deny the action for
   * @returns a dictionary with the denied action
   */
  @Router.post("/authorize/deny")
  async denyAction(session: SessionDoc, action: string, username: string) {
    const authorizee = (await Authing.getUserByUsername(username))._id;
    const authorizer = Sessioning.getUser(session);
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    Authorizing.assertIsValidAction(action);
    return await Authorizing.deny(authorizer, action);
  }

  /**
   * Gives control of the current session user's account to the given username.
   * 
   * @param session the session of the user
   * @param username the username to give control to
   * @returns a message indicating the success of the control transfer
   */
  @Router.post("/authorize/control")
  async giveControl(session: SessionDoc, username: string) {
    const authorizee = Sessioning.getUser(session);
    const authorizer = (await Authing.getUserByUsername(username))._id;
    return await Authorizing.addAuthorizer(authorizer, authorizee);
  }

  /**
   * Revokes control of the current session user's account from the given username.
   * 
   * @param session the session of the user
   * @param username the username to revoke control from, the user must already be allowed to authorize actions on the target username's account
   * @returns a message indicating the success of the control revocation
   */
  @Router.delete("/authorize/control")
  async revokeControl(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.removeAuthorizer(authorizer, authorizee);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
