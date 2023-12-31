const app = require("../../app");
const request = require("supertest");
require("../mongodb_helper");
const mongoose = require("mongoose");
const Post = require("../../models/post");
const User = require("../../models/user");
const JWT = require("jsonwebtoken");
const secret = process.env.JWT_SECRET;
// for mocking the image file
const fs = require("fs");
const path = require("path");
const { afterEach } = require("@jest/globals");

let token;
let user;

let token2;
let user2;

describe("/posts", () => {
  beforeAll(async () => {
    user = new User({
      username: "test",
      email: "test@test.com",
      password: "12345678",
      avatar: "public/images/avatars/1.svg",
    });
    await user.save();

    token = JWT.sign(
      {
        user_id: user.id,
        // Backdate this token of 5 minutes
        iat: Math.floor(Date.now() / 1000) - 5 * 60,
        // Set the JWT token to expire in 10 minutes
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
      },
      secret,
    );
  });

  beforeEach(async () => {
    await Post.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
  });

  describe("POST, when token is present", () => {
    test("responds with a 201", async () => {
      let response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello world", token: token });
      expect(response.status).toEqual(201);
    });

    test("creates a new post", async () => {
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello world", token: token });

      let posts = await Post.find();
      expect(posts.length).toEqual(1);
      expect(posts[0].message).toEqual("hello world");

      expect(posts[0].user_id).toEqual(user._id);
    });

    test("returns a new token", async () => {
      let response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello world", token: token });
      let newPayload = JWT.decode(response.body.token, process.env.JWT_SECRET);
      let originalPayload = JWT.decode(token, process.env.JWT_SECRET);
      expect(newPayload.iat > originalPayload.iat).toEqual(true);
    });
  });

  describe("POST, when token is missing", () => {
    test("responds with a 401", async () => {
      let response = await request(app)
        .post("/posts")
        .send({ message: "hello again world" });
      expect(response.status).toEqual(401);
    });

    test("a post is not created", async () => {
      await request(app).post("/posts").send({ message: "hello again world" });
      let posts = await Post.find();
      expect(posts.length).toEqual(0);
    });

    test("a token is not returned", async () => {
      let response = await request(app)
        .post("/posts")
        .send({ message: "hello again world" });
      expect(response.body.token).toEqual(undefined);
    });
  });

  describe("GET, when token is present", () => {
    test("returns every post in the collection", async () => {
      let post1 = new Post({ message: "howdy!" });
      let post2 = new Post({ message: "hola!" });
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: token });
      let messages = response.body.posts.map((post) => post.message);
      expect(messages).toEqual(["howdy!", "hola!"]);
    });

    test("the response code is 200", async () => {
      let post1 = new Post({ message: "howdy!" });
      let post2 = new Post({ message: "hola!" });
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: token });
      expect(response.status).toEqual(200);
    });

    test("returns a new token", async () => {
      let post1 = new Post({ message: "howdy!" });
      let post2 = new Post({ message: "hola!" });
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: token });
      let newPayload = JWT.decode(response.body.token, process.env.JWT_SECRET);
      let originalPayload = JWT.decode(token, process.env.JWT_SECRET);
      expect(newPayload.iat > originalPayload.iat).toEqual(true);
    });
  });

  describe("GET, when token is missing", () => {
    test("returns no posts", async () => {
      let post1 = new Post({ message: "howdy!" });
      let post2 = new Post({ message: "hola!" });
      await post1.save();
      await post2.save();
      let response = await request(app).get("/posts");
      expect(response.body.posts).toEqual(undefined);
    });

    test("the response code is 401", async () => {
      let post1 = new Post({ message: "howdy!" });
      let post2 = new Post({ message: "hola!" });
      await post1.save();
      await post2.save();
      let response = await request(app).get("/posts");
      expect(response.status).toEqual(401);
    });

    test("does not return a new token", async () => {
      let post1 = new Post({ message: "howdy!" });
      let post2 = new Post({ message: "hola!" });
      await post1.save();
      await post2.save();
      let response = await request(app).get("/posts");
      expect(response.body.token).toEqual(undefined);
    });
  });
});

describe("/profile/:user_id, postsController", () => {
  beforeAll(async () => {
  });

  beforeEach(async () => {
    await Post.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
  });

  test("Filter and find posts by user_id and displaying in order", async () => {
    // USER1
    user = new User({
      username: "test",
      email: "test@test.com",
      password: "test",
      avatar: "1.svg",
    });
    await user.save();

    token = JWT.sign(
      {
        user_id: user.id,
        // Backdate this token of 5 minutes
        iat: Math.floor(Date.now() / 1000) - 5 * 60,
        // Set the JWT token to expire in 10 minutes
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
      },
      secret,
    );

    // User 1 creates a posts with their token
    await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "post by user 1!", token: token });

    await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "hola! by user 1", token: token });

    let posts1 = await Post.find();

    // USER 2: creating second user to post posts with different user id's
    user2 = new User({
      username: "test2",
      email: "test2@test.com",
      password: "test2",
      avatar: "2.svg",
    });
    await user2.save();

    token2 = JWT.sign(
      {
        user_id: user2.id,
        // Backdate this token of 5 minutes
        iat: Math.floor(Date.now() / 1000) - 5 * 60,
        // Set the JWT token to expire in 10 minutes
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
      },
      secret,
    );

    // User 2 creates a posts with their token
    await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token2}`)
      .send({ message: "post by user 2!", token: token2 });

    await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token2}`)
        .send({ message: "hola! by user 2", token: token2 })
    
      let new_response = await request(app)
        .get(`/profile/${user2._id}`)
        .set("Authorization", `Bearer ${token2}`)
        .send({ token: token2 });
      // mapping messages from post objects in response body
      expect(new_response.body.posts.map((post) => post.message)).toEqual(["hola! by user 2", "post by user 2!"]);
  });
});



describe("likePost", () => {
  beforeEach(async () => {
    await Post.deleteMany({});
  });

  test("user can like a post", async () => {
    // Create a post
    const postResponse = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Some message", token: token });

    // Like the post
    const likeResponse = await request(app)
      .post(`/posts/like/${postResponse.body._id}`)  
      .set("Authorization", `Bearer ${token}`)
      .send();
  
    // Check the response
    expect(likeResponse.status).toEqual(200);
    expect(likeResponse.body.message).toEqual("Post liked");
    expect(likeResponse.body.token).toBeDefined();
  
    // Check if the post in the database has the user in the likes array
    // const likedPost = await Post.findById(postResponse.body._id);
    

    // expect(likedPost.likes).toContain([user.id]);
  });
});


