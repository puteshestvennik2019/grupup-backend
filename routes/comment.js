const express = require("express");
const router = express.Router();
const commentCtrl = require("../controllers/comment");
const jwtCheck = require("../middleware/jwtCheck");

router.post("/p/:id", jwtCheck, commentCtrl.newComment);
router.post("/c/:id", jwtCheck, commentCtrl.newReply);

module.exports = router;
