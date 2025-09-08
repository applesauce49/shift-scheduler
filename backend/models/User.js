const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const User = new Schema({
  username: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  hash: String,
  salt: String,
  memberSince: String,
  gender: { type: String, enum: ['male', 'female', 'non-binary', 'other'] },
  maritalstatus: { type: String, enum: ['single', 'married', 'divorced', 'widowed', 'other'] },
  status: String,
  admin: { type: Boolean, default: false },
  blockedDates: [{ date: String, comment: String, approved: Boolean, approvedBy: String }],
});

module.exports = mongoose.model('User', User);
