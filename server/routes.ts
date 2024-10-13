import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Posting, Sessioning, Messaging, Authorizing, Nudging, Recording } from "./app";
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
   * Creates a post with the given content if the user is allowed to post.
   * If the user's posting activity is being tracked, a record is created as well.
   *
   * @param session the session of the user, the user must be allowed to post
   * @param content the text of the post
   * @param options customizations of the post, e.g. background color
   * @returns the created post
   */
  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Post");
    const created = await Posting.create(user, content, new Date(), options);
    if (await Recording.isAutomatic(user, "Post")) {
      await Recording.create(user, "Post", new Date());
    }
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  /**
   * Updates a post with the given input.
   *
   * @param session the session of the user, the user must be allowed to post and be the author of the post
   * @param id the post id
   * @param content new text to update the post with
   * @param options new customizations of the post
   * @returns the updated post
   */
  @Router.patch("/posts/:id")
  @Router.validate(z.object({ id: z.string(), content: z.string().optional() }))
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
   * @param session the session of the user, the user must be allowed to post and be the author of the post
   * @param id the post id
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
  @Router.validate(z.object({ sender: z.string().optional() }))
  async getMessages(sender?: string) {
    let messages;

    if (sender) {
      const sender_id = (await Authing.getUserByUsername(sender))._id;
      messages = await Messaging.getBySender(sender_id);
    } else {
      messages = await Messaging.getMessages();
    }
    return Responses.messages(messages);
  }

  /**
   *  Sends a message from the current session user to the given username.
   *  If the user's message activity is being tracked, a record is created as well.
   *
   * @param session  the session of the user, the user must be allowed to message
   * @param to the username of the user to send the message to, user must exist and be allowed to message, to != from
   * @param content the text of the message
   * @returns the created message
   */
  @Router.post("/messages")
  async sendMessage(session: SessionDoc, to: string, content: string) {
    const receiver = (await Authing.getUserByUsername(to))._id;
    const sender = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(sender, "Message");
    await Authorizing.assertActionIsAllowed(receiver, "Message");
    if (await Recording.isAutomatic(sender, "Message")) {
      await Recording.create(sender, "Message", new Date());
    }
    const created = await Messaging.send(sender, receiver, content);
    console.log(created);
    return { msg: created.msg, message: await Responses.message(created.message) };
  }

  /**
   *  Deletes a message with the given id.
   *
   * @param session the session of the user, the user must be allowed to message and be the sender of the message
   * @param id the message id
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
  @Router.validate(z.object({ receiver: z.string().optional(), time: z.string().optional() }))
  async getNudges(receiver?: string, time?: string) {
    let nudges;
    if (receiver) {
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
   *
   * @param session the session of the user, the user must be allowed to nudge
   * @param to the username of the user to send the nudge to, user must exist and be allowed to nudge & message,
   *           can be the current session user
   * @param time the time of the nudge, must be now or in the future
   * @returns the created nudge
   */
  @Router.post("/nudges/message")
  async sendNudgeForMessage(session: SessionDoc, to: string, time?: string) {
    const sender = Sessioning.getUser(session);
    const receiver = (await Authing.getUserByUsername(to))._id;
    const timeDate = time ? new Date(time) : new Date();
    await Authorizing.assertActionIsAllowed(sender, "Nudge");
    await Authorizing.assertActionIsAllowed(receiver, "Nudge");
    await Authorizing.assertActionIsAllowed(receiver, "Message");
    const created = await Nudging.create("Message", timeDate, receiver, sender);
    return { msg: created.msg, nudge: await Responses.nudge(created.nudge) };
  }

  /**
   * Creates multiple nudges for the current session user to perform an action for the given time parameters.
   *
   * @param session the session of the user, the user must be allowed to nudge and message
   * @param startTime the start time of the nudges, must be after or equal to the current time
   * @param endTime the end time of the nudges, must be after the start time
   * @param frequency how spaced apart the nudges should be sent, in number of days, must be integer > 0
   * @param to the username of the user to send the nudge to, user must exist and be allowed to nudge & message, can be the current session user
   * @returns the created nudges
   */
  @Router.post("/nudges/message/periodic")
  async sendPeriodicNudgeForMessage(session: SessionDoc, start: string, end: string, frequency: string, to: string) {
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
    const created = await Nudging.createMany("Message", new Date(start), new Date(end), parseInt(frequency), toUser, from);
    return { msg: await created.msg, nudges: await Responses.nudges(created.nudges) };
  }

  /**
   * Deletes a nudge with the given id.
   *
   * @param session the session of the user, the user must be allowed to nudge and be the sender of the nudge
   * @param id the nudge id
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
  @Router.validate(z.object({ receiver: z.string().optional() }))
  async getRecords(receiver?: string) {
    let records;
    if (receiver) {
      const id = (await Authing.getUserByUsername(receiver))._id;
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
   * @param action the text of the record action, can be any generic action
   * @param time the time of the record, defaults to the current time
   * @returns a dictionary with the created record
   */
  @Router.post("/records")
  async createRecord(session: SessionDoc, action: string, time?: string) {
    const user = Sessioning.getUser(session);
    const timeDate = time ? new Date(time) : new Date();
    await Authorizing.assertActionIsAllowed(user, "Record");

    const created = await Recording.create(user, action, timeDate);
    return { msg: created.msg, record: await Responses.record(created.record) };
  }

  /**
   * Deletes a record with the given id.
   *
   * @param session the session of the current user, the user must be allowed to record and
   *                be user associated with the record
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
   *  Indicates that records will be automatically created for any time the current user does a messaging action.
   *
   * @param session the session of the user, the user must be allowed to record and message
   *                automatic message recording must not already be enabled
   * @returns a dictionary with the created record
   */
  @Router.post("/records/automatic/message")
  async startAutomaticRecordForMessaging(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Message");

    const created = await Recording.startAutomaticRecording(user, "Message");
    return { msg: created.msg, automatic_record: await Responses.automatic_record(created.automatic_record) };
  }

  /**
   * Stops automatically creating records for message actions for the current session user
   * for all future (messaging) activity
   *
   * @param session the session of the user, the user must be allowed to record and message
   *                and have automatic message recording enabled
   */
  @Router.delete("/records/automatic/message")
  async stopAutomaticMessageTracking(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Message");

    return await Recording.stopAutomaticRecording(user, "Message");
  }

  /**
   *  Creates an automatic record for the current session user for posting.
   *  Indicates that automatic records will start for their posting activity.
   *
   * @param session the session of the user, the user must be allowed to record and post
   *                automatic post recording must not already be enabled
   * @returns a dictionary with the created automatic record
   */
  @Router.post("/records/automatic/post")
  async startAutomaticPostTracking(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Post");

    const created = await Recording.startAutomaticRecording(user, "Post");
    return { msg: created.msg, automatic_record: await Responses.automatic_record(created.automatic_record) };
  }

  /**
   * Stops automatically creating records for post actions for the current session user
   * for all future (posting) activity
   *
   * @param session the session of the user, the user must be allowed to record and post
   *                and have automatic post recording enabled
   */
  @Router.delete("/records/automatic/post")
  async stopAutomaticPostTracking(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    await Authorizing.assertActionIsAllowed(user, "Record");
    await Authorizing.assertActionIsAllowed(user, "Post");

    return await Recording.stopAutomaticRecording(user, "Post");
  }

  /**
   * Gets the actions that the parametrized user with the given username is denied from performing.
   * @returns a list of denied actions
   */
  @Router.get("/authorize/deny/:username")
  @Router.validate(z.object({ username: z.string().optional() }))
  async getDeniedActions(username: string) {
    const userOid = (await Authing.getUserByUsername(username))._id;
    return await Authorizing.getDeniedActionByUser(userOid);
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
   * Allows the given username to perform all messaging actions if not already allowed.
   *
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow messaging for
   * @returns  a dictionary with the allowed action
   */
  @Router.post("/authorize/allow/message")
  async authorizeMessaging(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.allow(authorizee, "Message");
    return { msg: created.msg, user: await Authing.idToUsername(created.user), action: created.action };
  }

  /**
   * Denies the given username from performing all messaging actions if not already denied.
   *
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny messaging for
   * @returns the denied action
   */
  @Router.post("/authorize/deny/message")
  async denyMessaging(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.deny(authorizee, "Message");
    return { msg: created.msg, authorization: await Responses.authorization(created.authorization) };
  }

  /**
   * Allows the given username to perform all posting actions if not already allowed.
   *
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow posting for
   * @returns the allowed authorization
   */
  @Router.post("/authorize/allow/post")
  async authorizePosting(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.allow(authorizee, "Post");
    return { msg: created.msg, user: await Authing.idToUsername(created.user), action: created.action };
  }

  /**
   * Denies the given username from performing all posting actions if not already denied.
   *
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny posting for
   * @returns the denied authorization
   */
  @Router.post("/authorize/deny/post")
  async denyPosting(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.deny(authorizee, "Post");
    return { msg: created.msg, authorization: await Responses.authorization(created.authorization) };
  }

  /**
   * Allows the given username to perform all nudging actions if not already allowed.
   *
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow nudging for
   * @returns the allowed authorization
   */
  @Router.post("/authorize/allow/nudge")
  async authorizeNudge(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.allow(authorizee, "Nudge");
    return { msg: created.msg, user: await Authing.idToUsername(created.user), action: created.action };
  }

  /**
   * Denies the given username from performing all nudging actions if not already denied.
   *
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny nudging for
   * @returns the denied authorization
   */
  @Router.post("/authorize/deny/nudge")
  async denyNudging(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.deny(authorizee, "Nudge");
    return { msg: created.msg, authorization: await Responses.authorization(created.authorization) };
  }

  /**
   * Allows the given username to perform all recording actions if not already allowed.
   *
   * @param session  the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to allow recording for
   * @returns the allowed authorization
   */
  @Router.post("/authorize/allow/record")
  async authorizeRecord(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.allow(authorizee, "Record");
    return { msg: created.msg, user: await Authing.getUserById(created.user), action: created.action };
  }

  /**
   * Denies the given username from performing all recording actions if not already denied.
   *
   * @param session the session of the user, the user must be allowed to authorize actions on the target username's account
   * @param username the username to deny recording for
   * @returns the denied authorization
   */
  @Router.post("/authorize/deny/record")
  async denyRecording(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    const created = await Authorizing.deny(authorizee, "Record");
    return { msg: created.msg, authorization: await Responses.authorization(created.authorization) };
  }

  /**
   * Gets the usernames of users who the parametrized user has authorization access and who can authorize actions on the parametrized user's account.
   * If no username is given, the current session user's authorizations are returned.
   *
   * @param session the session of the user
   * @returns a dictionary of
   *    "authorizers": list of usernames who the parametrized user has given control to
   *    "authorizees": list of usernames who have given control to the parametrized user
   */
  @Router.get("/authorize/control/:username")
  @Router.validate(z.object({ username: z.string().optional() }))
  async getAuthorizations(username: string) {
    const user = (await Authing.getUserByUsername(username))._id;
    const authorizers = await Responses.user_controls(await Authorizing.getAuthorizersByAuthorizee(user));
    const authorizees = await Responses.user_controls(await Authorizing.getAuthorizeesByAuthorizer(user));
    return { authorizers: await authorizers.authorizers, authorizees: await authorizees.authorizees };
  }

  /**
   * Gives control of the current session user's account to the given username if control is not given already.
   *
   * @param session the session of the user
   * @param username the username to give control to
   */
  @Router.post("/authorize/control")
  async giveControl(session: SessionDoc, username: string) {
    const authorizee = Sessioning.getUser(session);
    const authorizer = (await Authing.getUserByUsername(username))._id;
    const created = await Authorizing.addAuthorizer(authorizer, authorizee);
    return { msg: created.msg, permission_control: await Responses.user_control(created.permission_control) };
  }

  /**
   * Revokes control of the current session user's account from the given username.
   *
   * @param session the session of the user
   * @param username the username to revoke control from, the user must already be allowed to authorize actions on the target username's account
   */
  @Router.delete("/authorize/control")
  async revokeControl(session: SessionDoc, username: string) {
    const authorizer = Sessioning.getUser(session);
    const authorizee = (await Authing.getUserByUsername(username))._id;
    await Authorizing.assertIsAuthorizer(authorizer, authorizee);
    return { msg: (await Authorizing.removeAuthorizer(authorizer, authorizee)).msg, authorizer: await Authing.idToUsername(authorizer), authorizee: await Authing.idToUsername(authorizee) };
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
