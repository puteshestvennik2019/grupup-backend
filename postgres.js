const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  password: "password",
  host: "localhost",
  port: 5432,
  database: "grupup",
});

// ================================

// client
//   .connect()
//   .then(() => console.log("Connected to postgres batabase"))
//   // .then(() => client.query("create table users_table"))
//   //   .then((res) => console.table(res.rows))
//   .catch((e) => console.log(e))
//   .finally(() => client.end());

// ===============================

module.exports = pool;
