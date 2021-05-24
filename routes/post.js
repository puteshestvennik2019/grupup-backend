const express = require("express");
const router = express.Router();
const postCtrl = require("../controllers/post");
const jwtCheck = require("../middleware/jwtCheck");

router.post("/g/:id", jwtCheck, postCtrl.createNewPost);
router.get("/g/:id", jwtCheck, postCtrl.getPostsFromSingleGroupup);
router.get("/p/:id", jwtCheck, postCtrl.getPost);
router.get("/", jwtCheck, postCtrl.getAllPosts);

module.exports = router;
