const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');

const {
  getAllSessions,
  getSessionById,
  uploadSession,
  deleteSession,
} = require('../controllers/session.controller');

// Multer config — save uploads to /uploads folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/',              getAllSessions);
router.get('/:id',           getSessionById);
router.post('/upload',       upload.single('pcap'), uploadSession);
router.delete('/:id',        deleteSession);

module.exports = router;
