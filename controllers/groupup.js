const pool = require("../postgres");

exports.getGroupupsByUser = async (req, res, next) => {
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
};

exports.joinGroupup = async (req, res, next) => {
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
};

exports.getAllGroupups = async (req, res, next) => {
  const groupups = await pool.query(
    "SELECT id, name, description, cardinality(members) AS num_members FROM groupups"
  );
  if (groupups.rowCount > 0) {
    res.status(200).json(groupups.rows);
  } else {
    res.status(500).json({ message: "Try again later" });
  }
};

exports.createNewGroupup = async (req, res, next) => {
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
};
