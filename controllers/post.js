const pool = require("../postgres");

exports.createNewPost = async (req, res) => {
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
};

exports.getPostsFromSingleGroupup = async (req, res) => {
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
};

exports.getPost = async (req, res) => {
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
};

exports.getAllPosts = async (req, res) => {
  const posts = await pool.query(
    `SELECT posts.id, groupup_id, groupups.name AS groupup_name, title, html_text, posts.created, author, score, num_comments, users.name AS author_name 
          FROM posts INNER JOIN users ON posts.author = users.id 
                     INNER JOIN groupups ON posts.groupup_id = groupups.id
          ORDER BY posts.created DESC`
  );
  res.status(200).send({ posts: posts.rows });
};
