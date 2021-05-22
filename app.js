require("dotenv").config();
const express = require("express");
const jwtCheck = require("./middleware/jwtCheck");
const axios = require("axios");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const insertToComments = require("./utils/insertToComments");

// ================================

const pool = require("./postgres");

// client
//   .connect()
//   .then(() => console.log("Connected to postgres batabase"))
//   // .then(() => client.query("create table users_table"))
//   //   .then((res) => console.table(res.rows))
//   .catch((e) => console.log(e))
//   .finally(() => client.end());

// ===============================

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  next();
});

app.use(cors());

// GET -- communities by user --
app.get("/api/g/user", jwtCheck, async (req, res) => {
  const userId = req.user.sub;

  const userGroupups = await pool.query(
    "SELECT groupups FROM users WHERE id = $1",
    [userId]
  );
  const groupups = await pool.query(
    "SELECT id, name, description, cardinality(members) AS num_members FROM groupups WHERE id = ANY($1)",
    [userGroupups.rows[0].groupups]
  );
  if (groupups.rowCount > 0) {
    res.status(200).json(groupups.rows);
  } else {
    res.status(500).json({ message: "Try again later" });
  }
});

// POST -- join community --
app.post("/api/g/user", jwtCheck, async (req, res) => {
  const userId = req.user.sub;
  const groupupId = req.body.id;

  // check if valid groupup id
  const groupup = await pool.query("SELECT id FROM groupups WHERE id = $1", [
    groupupId,
  ]);
  if (groupup.rowCount === 1) {
    // check if user already signed up
    const userGroupups = await pool.query(
      "SELECT groupups FROM users WHERE id = $1",
      [userId]
    );
    if (userGroupups.rows[0].groupups.includes(groupupId)) {
      console.log("User already signed up for this groupup");
      res.status(405).send({ error: "User already signed up" });
    } else {
      // update users table
      await pool.query(
        "UPDATE users SET groupups = groupups || $1 WHERE id = $2",
        [[groupupId], userId]
      );
      // update groupups table (=== although this information is probably not necessary there, depending on use case ===)
      await pool.query(
        "UPDATE groupups SET members = members || $1 WHERE id = $2",
        [[userId], groupupId]
      );
      res.status(201).send({ message: "Happy posting" });
    }
  } else {
    console.log(`Groupup ${groupupId} does not exist`);
    res.status(405).send({ error: "Community does not exist" });
  }
});

// GET -- all communities --
app.get("/api/g/", async (req, res) => {
  const groupups = await pool.query(
    "SELECT id, name, description, cardinality(members) AS num_members FROM groupups"
  );
  if (groupups.rowCount > 0) {
    res.status(200).json(groupups.rows);
  } else {
    res.status(500).json({ message: "Try again later" });
  }
});

// POST -- new community --
app.post("/api/g", jwtCheck, fileUpload(), async (req, res) => {
  const userId = req.user.sub;

  // TODO: if community with this name already exists, don't insert it

  // thumbnail could be saved in base64

  pool
    .query(
      `INSERT INTO groupups (name, description, created, members, thumbnail, posts)
              VALUES ($1, $2, trunc(extract(epoch from now())), $3, $4, $5)
              RETURNING id`,
      [
        req.body.name,
        req.body.description,
        [userId],
        req.files.thumbnail.data,
        [],
      ]
    )
    .then(async (resp) => {
      console.log(resp);
      // TODO: == refactor == this will be the same as for signing up to a groupup
      // add id to user's groupups[]
      const appendToMembers = await pool.query(
        "UPDATE users SET groupups = groupups || $1 WHERE id = $2",
        [[resp.rows[0].id], userId]
      );
      console.log(appendToMembers);
      res.status(201).json();
    })
    .catch((err) => {
      console.log(err);
      res.json(err);
    });
});

// POST new post
app.post("/api/g/:id", jwtCheck, async (req, res) => {
  const userId = req.user.sub;
  const groupupId = req.params.id;

  // check user is a member, groupup exists and title is not empty
  // THEN

  try {
    /*
     ** Querying this, I'm thinking 'author' could be a JSON column with id(sub) and name
     ** Another column for the name could also save extra querying
     */
    await pool.query(
      `INSERT INTO posts(id, groupup_id, title, html_text, created, author, comments, num_comments, score)
                                VALUES(uuid_generate_v4(), $1, $2, $3, trunc(extract(epoch from now())), $4, $5, 0, 0)`,
      [groupupId, req.body.title, req.body.html_text, userId, []]
    );
    res.status(201).send({ message: "Post added" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Something went wrong" });
  }
});

// GET posts from a groupup
app.get("/api/g/:id", async (req, res) => {
  const groupupId = req.params.id;
  // TODO: add comments
  const posts = await pool.query(
    `SELECT posts.id, groupup_id, groupups.name AS groupup_name, title, html_text, posts.created, author, score, num_comments, users.name AS author_name 
          FROM posts INNER JOIN users ON posts.author = users.id 
                     INNER JOIN groupups ON posts.groupup_id = groupups.id
          WHERE groupup_id = $1
          ORDER BY posts.created DESC`,
    [groupupId]
  );
  const groupups = await pool.query(
    `SELECT id, name, cardinality(members) AS num_members, thumbnail, description FROM groupups WHERE id = $1`,
    [groupupId]
  );
  res.status(200).send({ posts: posts.rows, groupup: groupups.rows[0] });
});

// GET (not a POST because there is no body) mark post as read
app.get("/u/read/:id", jwtCheck, async (req, res) => {
  const sub = req.user.sub;
  const postId = req.params.id;
  const readPosts = await pool.query(
    "SELECT read_posts FROM users WHERE id = $1",
    [sub]
  );
  if (readPosts.rows[0].read_posts.includes(postId)) {
    console.log("Post id already in read posts array");
  } else {
    pool
      .query(`UPDATE users SET read_posts = read_posts || $1 WHERE id = $2`, [
        [postId],
        sub,
      ])
      .then(() => {
        res.status(201);
      })
      .catch((error) => console.log(error));
  }
});

// GET user info (sign up if user doesn't exist - this could be triggered by an Auth0 hook)
app.get("/u/:id", jwtCheck, async (req, res) => {
  const sub = req.user.sub;
  if (req.params.id !== sub) res.status(401).json({});
  else {
    let user = await pool.query("SELECT * FROM users WHERE id = $1", [sub]);
    // if user doesn't exist, add user to table
    if (user.rowCount !== 1) {
      axios(
        `${process.env.AUTH0_ISSUER_BASE_URL}api/v2/users/${sub}?fields=username%2Cnickname&include_fields=true`,
        {
          headers: {
            authorization: `Bearer ${process.env.MANAGAMENT_API_TOKEN}`,
          },
        }
      ).then(async (response) => {
        const username = response.data.username || response.data.nickname;
        user = await pool
          .query(
            "INSERT INTO users (id, read_posts, upvoted, downvoted, groupups, name) VALUES($1, $2, $2, $2, $2, $3) RETURNING *",
            [sub, [], username]
          )
          .catch((error) => console.log(error));
      });
    }
    res.status(200).json(user.rows[0]);
  }
});

// DELETE user
app.delete("/u/:id", jwtCheck, async (req, res) => {
  const sub = req.user.sub;
  if (req.params.id !== sub)
    res.status(401).json(new Error({ message: "Unauthorized operation" }));
  else {
    axios
      .delete(`${process.env.AUTH0_ISSUER_BASE_URL}api/v2/users/${sub}`, {
        headers: {
          authorization: `Bearer ${process.env.MANAGAMENT_API_TOKEN}`,
        },
      })
      .then(() => {
        pool
          .query("DELETE FROM users WHERE id = $1", [sub])
          .then((resp) => {
            if (resp.rowCount !== 1) console.log(resp);
            else {
              // TODO: map this user's posts to {author: 'Deleted account'}
              //       remove user from groupups
            }
            res.status(204).json({ message: "Successfully deleted user" });
          })
          .catch((error) => console.log(error));
      })
      .catch((error) => res.json(error));
  }
});

// POST downvoting / upvoting
app.post("/vote", jwtCheck, async (req, res) => {
  const sub = req.user.sub;
  const queryUserVotes = await pool.query(
    "SELECT upvoted, downvoted FROM users WHERE id = $1",
    [sub]
  );
  const voteVal = req.body.voteVal;
  const postId = req.body.postId;

  if (voteVal === 1) {
    if (queryUserVotes.rows[0].upvoted.includes(postId)) {
      res.status(200);
    } else {
      // updata overal score
      pool.query("UPDATE posts SET score = score + 1 WHERE id = $1", [postId]);
      if (queryUserVotes.rows[0].downvoted.includes(postId)) {
        pool
          .query(
            "UPDATE users SET downvoted = array_remove(downvoted, $1) WHERE id = $2",
            [postId, sub]
          )
          .then(() => {
            res.status(200);
          });
      } else {
        pool
          .query(
            "UPDATE users SET upvoted = array_append(upvoted, $1) WHERE id = $2",
            [postId, sub]
          )
          .then(() => {
            res.status(200);
          });
      }
    }
  } else if (voteVal === -1) {
    // updata overal score
    pool.query("UPDATE posts SET score = score - 1 WHERE id = $1", [postId]);
    if (queryUserVotes.rows[0].downvoted.includes(postId)) {
      res.status(200);
    } else {
      if (queryUserVotes.rows[0].upvoted.includes(postId)) {
        pool
          .query(
            "UPDATE users SET upvoted = array_remove(upvoted, $1) WHERE id = $2",
            [postId, sub]
          )
          .then(() => {
            res.status(200);
          });
      } else {
        pool
          .query(
            "UPDATE users SET downvoted = array_append(downvoted, $1) WHERE id = $2",
            [postId, sub]
          )
          .then(() => {
            res.status(200);
          });
      }
    }
  } else {
    res.status(404);
  }
});

// GET a single post
app.get("/api/p/:id", jwtCheck, async (req, res) => {
  const postId = req.params.id;
  // select post without comments body
  const postData = await pool.query(
    `SELECT posts.id, groupup_id, groupups.name AS groupup_name, title, html_text, posts.created, author, score, num_comments, users.name AS author_name, comments, comments_array
          FROM posts INNER JOIN users ON posts.author = users.id 
                     INNER JOIN groupups ON posts.groupup_id = groupups.id
          WHERE posts.id = $1`,
    [postId]
  );
  // TODO: if no data...

  const commentsArray = await pool.query(
    `SELECT comments.id, author, created, html_text, users.name AS author_name
          FROM comments INNER JOIN users ON author = users.id
          WHERE comments.id = ANY($1)`,
    [postData.rows[0].comments_array]
  );

  res
    .status(200)
    .json({ post: postData.rows[0], comments: commentsArray.rows });
});

// POST new comment to the post with postId
app.post("/api/p/:id", jwtCheck, async (req, res) => {
  const sub = req.user.sub;
  const postId = req.body.postId;
  const html_text = req.body.html_text;

  // Should be checking first if correct postId is passed
  // I guess I could update the posts table first, generating the uuid as I do it...

  const insertComment = await pool.query(
    `INSERT INTO comments (id, author, post_id, html_text, created) 
      VALUES(uuid_generate_v4(), $1, $2, $3, trunc(extract(epoch from now())))
      RETURNING id`,
    [sub, postId, html_text]
  );
  // THEN
  // update post in posts
  const commentId = insertComment.rows[0].id;
  const commentObj = {
    id: commentId,
    childComments: [],
  };
  pool.query(
    `UPDATE posts 
      SET comments = comments || $1,
          comments_array = comments_array || $2,
          num_comments = num_comments + 1
      WHERE id = $3`,
    [[commentObj], [commentId], postId]
  );
  res.status(201);
});

// POST new reply to the comment with commentId
app.post("/api/c/:id", jwtCheck, async (req, res) => {
  const sub = req.user.sub;
  const parentId = req.body.parentId;
  const postId = req.body.postId;
  const html_text = req.body.html_text;

  const insertComment = await pool.query(
    `INSERT INTO comments (id, author, post_id, parent_id, html_text, created) 
      VALUES(uuid_generate_v4(), $1, $2, $3, $4, trunc(extract(epoch from now())))
      RETURNING id`,
    [sub, postId, parentId, html_text]
  );
  const commentId = insertComment.rows[0].id;

  // THEN
  // update post in posts
  const selectComments = await pool.query(
    "SELECT comments FROM posts WHERE id = $1",
    [postId]
  );
  if (selectComments.rowCount === 1) {
    const commentsTree = insertToComments(
      selectComments.rows[0].comments,
      parentId,
      commentId
    );
    pool
      .query(
        `UPDATE posts 
              SET comments = $1,
                  comments_array = comments_array || $2,
                  num_comments = num_comments + 1 
              WHERE id = $3`,
        [commentsTree, [commentId], postId]
      )
      .then(() => res.status(201));
  } else res.status(404);
});

// GET 'all' posts
// TODO: tweak so that only user's groupups are considered
app.get("/api", async (req, res) => {
  const posts = await pool.query(
    `SELECT posts.id, groupup_id, groupups.name AS groupup_name, title, html_text, posts.created, author, score, num_comments, users.name AS author_name 
          FROM posts INNER JOIN users ON posts.author = users.id 
                     INNER JOIN groupups ON posts.groupup_id = groupups.id
          ORDER BY posts.created DESC`
  );
  res.status(200).send({ posts: posts.rows });
});

module.exports = app;
