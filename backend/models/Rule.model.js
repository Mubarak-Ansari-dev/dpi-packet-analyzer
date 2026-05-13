const mongoose = require('mongoose');

// Persisted firewall blocking rule
const ruleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['IP', 'APP', 'DOMAIN', 'PORT'],
    required: true,
  },
  value:       { type: String, required: true }, // IP address / app name / domain / port
  enabled:     { type: Boolean, default: true },
  description: String,
  hitCount:    { type: Number, default: 0 },     // packets blocked by this rule
  createdAt:   { type: Date, default: Date.now },
});

// Prevent duplicate rules
ruleSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('Rule', ruleSchema);
