const express = require("express");
const router = express.Router();
const userCtrl = require("../controllers/user");
const jwtCheck = require("../middleware/jwtCheck");

router.get("/read/:id", jwtCheck, userCtrl.saveReadPost);
router.get("/:id", jwtCheck, userCtrl.getUserInfo);
router.delete("/:id", jwtCheck, userCtrl.deleteUser);
router.post("/vote", jwtCheck, userCtrl.vote);

module.exports = router;
