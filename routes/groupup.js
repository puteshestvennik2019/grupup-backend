const express = require("express");
const router = express.Router();
const groupupCtrl = require("../controllers/groupup");
const fileUpload = require("express-fileupload");
const jwtCheck = require("../middleware/jwtCheck");

router.get("/user", jwtCheck, groupupCtrl.getGroupupsByUser);
router.post("/user", jwtCheck, groupupCtrl.joinGroupup);
router.get("/", groupupCtrl.getAllGroupups);
router.post("/", jwtCheck, fileUpload(), groupupCtrl.createNewGroupup);

module.exports = router;
