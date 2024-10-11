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
    * if the user is allowed to post, the post is created and returned.
    * if the user's posting activity is being tracked, a record is created.
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
    if (await Recording.isAutomatic("Post")) {
      await Recording.create(user, "Post", new Date(), true);
    }
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
   *  if the user's message activity is being tracked, a record is created.
   * 
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
    if (await Recording.isAutomatic("Message")) {
      await Recording.create(sender, "Message", new Date(), true);
    }
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

  /**
   *  Gets all nudges based off input parameters. If no parameters are given, all nudges are returned by default.
   *  Otherwise, the nudges are filtered by the given parameters.
   * 
   * @param sender username of a valid user
   * @param receiver username of a valid user
   * @param time the earliest time of the nudges to return
   * @returns nudges that match the given parameters
   */
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
   * Sends a nudge from the current session user to the given username to message.
   * @param session the session of the user, the user must be allowed to nudge
   * @param to the username of the user to send the nudge to, user must exist and be allowed to nudge & message
   * @param time the time of the nudge, defaults to the current time
   * @returns a dictionary with the created nudge
   */
  @Router.post("/nudges/message")
  async sendNudgeForMessage(session: SessionDoc, to: string, time?: string) {
    const receiver = (await Authing.getUserByUsername(to))._id;
    const sender = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    await Authorizing.assertActionIsAllowed(sender, "Nudge");
    await Authorizing.assertActionIsAllowed(receiver, "Nudge");
    await Authorizing.assertActionIsAllowed(receiver, "Message");
    const created = await Nudging.create('Message', timeDate, receiver, sender);
    return { msg: created.msg, nudge: Responses.nudge(created.nudge) };
  }

  /**
   * Creates multiple nudges for the current session user to perform an action for the given time parameters.
   * @param session the session of the user, the user must be allowed to nudge and message
   * @param startTime the start time of the nudges, must be after or equal to the current time
   * @param endTime the end time of the nudges, must be after the start time
   * @param frequency how frequently the nudges should be sent, in number of days, must be integer > 0
   * @param to the username of the user to send the nudge to, user must exist and be allowed to nudge & message, if not given, nudge is sent to the current session user
   * @returns a dictionary with the created nudges
   */
  @Router.post("/nudges/message")
  async setPeriodicNudgeForMessage(session: SessionDoc, startTime: string, endTime: string, frequency: number, to?: string) {
    let toUser;
    if (to) {
      toUser = (await Authing.getUserByUsername(to))._id;
      await Authorizing.assertActionIsAllowed(toUser, "Nudge");
      await Authorizing.assertActionIsAllowed(toUser, "Message");
    } else {
      toUser = Sessioning.getUser(session);
    }
    const from = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(from, "Nudge");
    await Authorizing.assertActionIsAllowed(from, "Message");
    const created = await Nudging.createMany('Message', new Date(startTime), new Date(endTime), frequency, toUser, from);
    return { msg: created.msg, nudges: Responses.nudges(created.nudges) };
  } 

  /**
   * Deletes a nudge with the given id.
   * 
   * @param session the session of the user, the user must be allowed to nudge
   * @param id the nudge id
   * @returns a message indicating the success of the deletion
   */
  @Router.delete("/nudge/:id")
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
   * Creates a manual record with the given action.
   * 
   * @param session the session of the user, the user must be allowed to record
   * @param action the text of the record action, can be any generic action
   * @param time the time of the record, defaults to the current time
   * @returns a dictionary with the created record
   */
  @Router.post("/records")
  async createRecord(session: SessionDoc, action: string, time?: string) {
    const user = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    await Authorizing.assertActionIsAllowed(user, "Record");

    const created = await Recording.create(user, action, timeDate, false);
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

  /**
   *  Creates an automatic record for the current session user for messaging.
   *  Indicates that automatic records will start for their messaging activity.
   * 
   * @param session the session of the user, the user must be allowed to record and message
   * @returns a dictionary with the created record
   */
  @Router.post("/records/automatic/messaging")
  async startAutomaticRecordForMessaging(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Message");

    const created = await Recording.create(user, "Message", new Date(), true);
    return { msg: created.msg, record: Responses.record(created.record) };
  }

  /**
   *  Stops automatic recording for the current session user for messaging.
   *  Indicates that automatic records will stop for future messaging activity
   *  by creating a .
   * 
   * @param session the session of the user, the user must be allowed to record and message
   * @returns a dictionary with the created record
   */
  @Router.delete("/records/automatic/messaging")
  async stopAutomaticRecordForMessaging(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Message");

    const created = await Recording.create(user, "Message", new Date(), false);
    return { msg: created.msg, record: Responses.record(created.record) };
  }

  /**
   *  Creates an automatic record for the current session user for posting.
   *  Indicates that automatic records will start for their posting activity.
   * 
   * @param session the session of the user, the user must be allowed to record and post
   * @returns a dictionary with the created record
   */
  @Router.post("/records/automatic/posting")
  async startAutomaticRecordForPosting(session: SessionDoc, time?: string) {
    const user = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Post");

    const created = await Recording.create(user, "Post", timeDate, true);
    return { msg: created.msg, record: Responses.record(created.record) };
  }

  /**
   *  Stops automatic recording for the current session user for posting.
   *  Indicates that automatic records will stop for future posting activity TODO:
   * 
   * @param session the session of the user, the user must be allowed to record and post
   * @returns a dictionary with the created record
   */
  @Router.delete("/records/automatic/posting")
  async stopAutomaticRecordForPosting(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Post");

    const created = await Recording.create(user, "Post", new Date(), false);
    return { msg: created.msg, record: Responses.record(created.record) };
  }

  /**
   * Gets the actions that the current session user is denied from performing.
   * @param session the session of the user
   * @returns a list of denied actions
   */
  @Router.get("/authorize")
  async getCurrentUserDeniedActions(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authorizing.getDeniedActionByUser(user);
  }

   /**
   * Gets the actions that the parametrized user is denied from performing.
   * @returns a list of denied actions
   */
  @Router.get("/authorize/:username")
  async getDeniedActions(username: string) {
    const userOid = (await Authing.getUserByUsername(username))._id;
    return await Authorizing.getDeniedActionByUser(userOid);
  }

  /**
   * Allows the given username to perform all messaging actions.
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow messaging for
   * @returns  a dictionary with the allowed action
   */
  @Router.post("/authorize/allow/message")
  async authorizeMessaging(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.allow(authorizee, "Message");
  }

  /**
   * Denies the given username from performing all messaging actions.
   * 
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny messaging for
   * @returns a dictionary with the denied action
   */
  @Router.post("/authorize/deny/message")
  async denyMessaging(session: SessionDoc, username: string) {
    const authorizee = (await Authing.getUserByUsername(username))._id;
    const authorizer = Sessioning.getUser(session);
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.deny(authorizer, "Message");
  }

  /**
   * Allows the given username to perform all posting actions.
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow posting for
   * @returns  a dictionary with the allowed action
   */
  @Router.post("/authorize/allow/post")
  async authorizePosting(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.allow(authorizee, "Post");
  }

  /**
   * Denies the given username from performing all posting actions.
   * 
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny posting for
   * @returns a dictionary with the denied action
   */
  @Router.post("/authorize/deny/post")
  async denyPosting(session: SessionDoc, username: string) {
    const authorizee = (await Authing.getUserByUsername(username))._id;
    const authorizer = Sessioning.getUser(session);
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.deny(authorizer, "Message");
  }

  /**
   * Allows the given username to perform all nudging actions.
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow nudging for
   * @returns  a dictionary with the allowed action
   */
  @Router.post("/authorize/allow/nudge")
  async authorizeNudge(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.allow(authorizee, "Nudge");
  }

  /**
   * Denies the given username from performing all nudging actions.
   * 
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny nudging for
   * @returns a dictionary with the denied action
   */
  @Router.post("/authorize/deny/nudge")
  async denyNudging(session: SessionDoc, username: string) {
    const authorizee = (await Authing.getUserByUsername(username))._id;
    const authorizer = Sessioning.getUser(session);
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.deny(authorizer, "Nudge");
  }

  /**
   * Allows the given username to perform all recording actions.
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow recording for
   * @returns  a dictionary with the allowed authorization
   */
  @Router.post("/authorize/allow/record")
  async authorizeRecord(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.allow(authorizee, "Record");
  }

  /**
   * Denies the given username from performing all recording actions.
   * 
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny recording for
   * @returns a dictionary with the denied action
   */
  @Router.post("/authorize/deny/record")
  async denyRecording(session: SessionDoc, username: string) {
    const authorizee = (await Authing.getUserByUsername(username))._id;
    const authorizer = Sessioning.getUser(session);
    Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return await Authorizing.deny(authorizer, "Record");
  }

  /**
   * Gets the usernames of users who the current session user has authorization access and who can authorize actions on the current session user's account.
   * 
   * @param session the session of the user
   * @returns a dictionary of 
   *    "authorizers": list of usernames who the current session user has given control to
   *    "authorizees": list of usernames who have given control to the current session user
   */
  @Router.get("/authorize/control")
  async getAuthorizations(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    const authorizers = await Authorizing.getAuthorizersByAuthorizee(user);
    const authorizees = await Authorizing.getAuthorizeesByAuthorizer(user);
    let authorizers_strings = new Array<string>();
    let authorizees_strings = new Array<string>();

    if (authorizers != undefined) {
      authorizers_strings = await Authing.idsToUsernames(authorizers);
    } 
    if (authorizees != undefined) {
      authorizees_strings = await Authing.idsToUsernames(authorizees);
    }
    return {"authorizers": authorizers_strings, "authorizees": authorizees_strings};
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
