const pool = require("../postgres");
const insertToComments = require("../utils/insertToComments");

exports.newComment = async (req, res) => {
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
};

exports.newReply = async (req, res) => {
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
};
