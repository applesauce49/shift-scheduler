const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('./../models/User');
const Shift = require('./../models/Shift');
const genPassword = require('./../passport/passwordFunctions').genPassword;
const isAdmin = require('./middleware/isAdmin');
const _ = require('lodash');
const { nextMonday, getISOWeek, format } = require('date-fns');
const { listEvents, toSchedule } = require('../services/googleCalendar');

// USER API
router.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    const { id, username, admin, gender, maritalstatus, blockedDates } = req.user;
    res.json({ id, username, admin, gender, maritalstatus, blockedDates, isAuthenticated: true });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// ADMIN GET ALL USERS API
router.get('/api/users', isAdmin, async (req, res) => {
  if (req.isAuthenticated()) {
    const users = await User.find({});
    res.json(users);
  } else {
    res.json({ isAuthenticated: false });
  }
});

// REGISTER (admin only), LOGIN & LOGOUT
router.post('/register', isAdmin, async (req, res, next) => {
  try {
    const { username, password, email, gender, maritalstatus } = req.body;
    User.findOne({ $or: [{ username }, { email }] }, function (err, existing) {
      if (err) res.json(err.msg);
      if (existing) {
        if (existing.username === username) return res.json('UserAlreadyExists');
        if (email && existing.email === email) return res.json('EmailAlreadyExists');
      }
      if (!existing && username !== '') {
        const saltHash = genPassword(password);
        const { salt, hash } = saltHash;
        const newUser = new User({ username, email, hash, salt, gender, maritalstatus, memberSince: new Date().toLocaleDateString() });

        newUser.save().then((user) => {
          res.json('Registered');
        });
      }
    });
  } catch (error) {
    console.error(error);
  }
});

router.post('/login', passport.authenticate('local'), (req, res) => {
  res.send('loginSuccessful');
});

router.post('/logout', (req, res) => {
  req.logout();
  req.session.destroy(function (err) {
    if (!err) {
      res.status(200).clearCookie('connect.sid', { path: '/' }).json({ status: 'Success' });
    } else {
      console.error(err);
    }
  });
});

// BLOCK DATE REQUEST
router.post('/block-date', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const { date, comment } = req.body;
      const username = req.user.username;
      const [employee] = await User.find({ username });

      if (employee.blockedDates.find((element) => element.date === date)) {
        return res.json({ msg: 'BlockAlreadyRequested' });
      } else {
        await User.findOneAndUpdate(
          { username },
          { $push: { blockedDates: { date, comment, approved: false, approvedBy: '' } } }
        );
        return res.json({ msg: 'BlockRequestSuccess' });
      }
    } catch (error) {
      console.error(error);
    }
  } else {
    res.json('Invalid user.');
  }
});

// GET BLOCK REQUEST INFO
router.get('/api/request-info', async (req, res) => {
  try {
    const { employeeID, dateID } = req.query;

    const foundUser = await User.findById(employeeID);

    const filteredDate = _.filter(foundUser.blockedDates, { id: dateID });
    res.send(filteredDate);
  } catch (error) {
    console.error(error);
  }
});

// USER REMOVE REQUESTS
router.post('/delete-request', async (req, res) => {
  try {
    const { employeeID, dateID } = req.body;

    await User.findOneAndUpdate(
      { _id: employeeID },
      {
        $pull: { blockedDates: { _id: dateID } },
      }
    );
    res.send({ msg: 'RequestDeletionSuccess' });
  } catch (error) {
    console.error(error);
    res.send('Error');
  }
});

// USER GET SCHEDULE
router.get('/getSchedule', async (req, res) => {
  try {
    const shift = await Shift.find().sort({ _id: -1 }).limit(1);
    res.send(shift);
  } catch (error) {
    console.error(error);
    res.send('Error');
  }
});

// ADMIN SAVE SCHEDULE
router.post('/postSchedule', isAdmin, async (req, res) => {
  try {
    // save schedule to database
    const { savedSchedule, savedBy } = req.body;
    const currentDate = new Date();
    const upcomingMonday = nextMonday(currentDate);
    const name = `(WN ${getISOWeek(upcomingMonday)}) ${format(upcomingMonday, `dd-MM-yyyy`)}`;
    const newShift = await new Shift({
      name,
      data: savedSchedule,
      savedBy,
      date: upcomingMonday,
    });
    newShift.save();

    res.send('Success');
  } catch (error) {
    console.error(error);
    res.send(error.msg);
  }
});

// ADMIN IMPORT SCHEDULE FROM GOOGLE CALENDAR
router.post('/import-schedule', isAdmin, async (req, res) => {
  try {
    const base = req.body?.date ? new Date(req.body.date) : new Date();
    const tz = process.env.GOOGLE_TIMEZONE || 'UTC';
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) return res.status(400).send('GOOGLE_CALENDAR_ID not set');

    // Compute [Sunday 00:00 .. Saturday 23:59] window in UTC
    const monday = nextMonday(base);
    const start = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start); // Sunday end of day
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);

    const events = await listEvents({
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      timeZone: tz,
    });

    // Build user email -> user map for attendee resolution
    const allUsers = await User.find({}, { username: 1, email: 1 });
    const usersByEmail = allUsers.reduce((acc, u) => {
      if (u.email) acc[u.email.toLowerCase()] = { username: u.username };
      return acc;
    }, {});
    const schedule = toSchedule({ events, usersByEmail, timeZone: tz });

    if (req.query.dryRun === 'true') {
      return res.json({ schedule });
    }

    const name = `(WN ${getISOWeek(monday)}) ${format(monday, `dd-MM-yyyy`)}`;
    const savedBy = req.user?.username || 'system';
    const newShift = await new Shift({ name, data: schedule, savedBy, date: monday });
    await newShift.save();
    res.send('Success');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error');
  }
});

// ADMIN REMOVE SCHEDULE
router.post('/removeSchedule', isAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    console.log(id);

    await Shift.findByIdAndDelete(id);
  } catch (error) {
    console.log(error);
    res.send('Error');
  }
});

// ADMIN GET ALL SCHEDULE HISTORY
router.get('/getScheduleHistory', isAdmin, async (req, res) => {
  try {
    const shifts = await Shift.find({});
    res.send(shifts);
  } catch (error) {
    console.log(error);
    res.send('Error');
  }
});

// ADMIN GET USERS
router.get('/getUsers', isAdmin, async (req, res) => {
  try {
    const employees = await User.find({});
    res.json(employees);
  } catch (error) {
    console.error(error);
  }
});

// ADMIN MANAGE USERS REQUESTS
router.post('/toggle-request-status', isAdmin, async (req, res) => {
  try {
    const { dateID, employeeID, approverUsername } = req.body;
    const foundUser = await User.findById(employeeID);

    const filteredDate = _.filter(foundUser.blockedDates, { id: dateID });

    const [{ approved: isCurrentlyApproved }] = filteredDate;

    await User.findOneAndUpdate(
      { blockedDates: { $elemMatch: { _id: dateID } } },
      {
        $set: {
          'blockedDates.$.approved': !isCurrentlyApproved,
          'blockedDates.$.approvedBy': !isCurrentlyApproved ? approverUsername : '',
        },
      }
    );

    res.send({ msg: 'Success', operatedUser: foundUser.username, operation: !isCurrentlyApproved });
  } catch (error) {
    console.error(error);
  }
});

// ADMIN MANAGE USERS
router.post('/update-user', isAdmin, async (req, res) => {
  try {
    const { _id: id, username, password, email, gender, maritalstatus } = req.body.modalData;

    if (!username) {
      return res.send('UsernameIsEmpty');
    }

    // Uniqueness checks for username and email
    const existingByUsername = await User.findOne({ username });
    if (existingByUsername && existingByUsername.id !== id) {
      return res.send('UsernameTaken');
    }

    if (typeof email !== 'undefined' && email !== null && email !== '') {
      const existingByEmail = await User.findOne({ email });
      if (existingByEmail && existingByEmail.id !== id) {
        return res.send('EmailTaken');
      }
    }

    // Build allowlisted updates
    const updates = {};
    if (typeof username !== 'undefined') updates.username = username;
    if (typeof email !== 'undefined') updates.email = email;
    if (typeof gender !== 'undefined') updates.gender = gender;
    if (typeof maritalstatus !== 'undefined') updates.maritalstatus = maritalstatus;

    if (Object.keys(updates).length > 0) {
      await User.findOneAndUpdate({ _id: id }, updates);
    }

    if (password) {
      const { salt, hash } = genPassword(password);
      await User.findOneAndUpdate({ _id: id }, { $set: { salt, hash } });
    }

    return res.send('Success');
  } catch (error) {
    console.error(error);
    res.send(error.msg);
  }
});

// ADMIN DELETE USER
router.post('/delete-user', isAdmin, async (req, res) => {
  try {
    const { _id } = req.body;
    console.log(_id);
    await User.findByIdAndDelete(_id);
    res.send('RequestDeletionSuccess');
  } catch (error) {
    console.log(error);
    res.send(error.msg);
  }
});

// CATCH ALL ROUTE
router.get('*', (req, res) => {
  try {
    res.redirect('/');
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;
