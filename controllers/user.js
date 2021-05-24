const axios = require("axios");
const pool = require("../postgres");

exports.saveReadPost = async (req, res) => {
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
};

// GET user info (sign up if user doesn't exist - this could be triggered by an Auth0 hook)
exports.getUserInfo = async (req, res) => {
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
};

exports.deleteUser = async (req, res) => {
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
};

exports.vote = async (req, res) => {
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
};
