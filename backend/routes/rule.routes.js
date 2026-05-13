const express = require('express');
const router  = express.Router();

const {
  getAllRules,
  createRule,
  updateRule,
  deleteRule,
  clearAllRules,
} = require('../controllers/rule.controller');

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/',       getAllRules);
router.post('/',      createRule);
router.put('/:id',    updateRule);
router.delete('/:id', deleteRule);
router.delete('/',    clearAllRules);

module.exports = router;
