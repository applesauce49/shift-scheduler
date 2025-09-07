const { google } = require('googleapis');

function getAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('Google service account credentials are not set');
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
}

async function listEvents({ calendarId, timeMin, timeMax, timeZone }) {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: timeZone || 'UTC',
  });
  return res.data.items || [];
}

// Parse events into app schedule shape using simple conventions:
// - Prefer extendedProperties.private.slot = 'morning'|'middle'|'evening'
// - Derive usernames from a comma-separated list in summary like:
//   "Morning: alice,bob | Middle: carol,dave | Evening: erin,frank"
//   or from description when summary lacks names.
const { utcToZonedTime } = require('date-fns-tz');
const { getDay } = require('date-fns');

function toSchedule({ events, usersByEmail, timeZone }) {
  // 0..6 => Monday..Sunday; each is an array of { username, id, _id }
  const schedule = [[], [], [], [], [], [], []];

  const pushUsers = (dayIndex, slotOrder, usernames) => {
    usernames
      .map((u) => (u || '').trim())
      .filter(Boolean)
      .forEach((username, idx) => {
        const id = `${dayIndex}-${slotOrder}-${username}-${idx}`;
        schedule[dayIndex].push({ username, id, _id: id });
      });
  };

  const parseNamesBySlot = (text) => {
    if (!text) return null;
    const out = {};
    const parts = text.split('|');
    parts.forEach((p) => {
      const [labelRaw, namesRaw] = p.split(':');
      if (!labelRaw || !namesRaw) return;
      const label = labelRaw.toLowerCase().trim();
      const names = namesRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (label.includes('morning')) out.morning = names;
      else if (label.includes('middle')) out.middle = names;
      else if (label.includes('evening')) out.evening = names;
    });
    return Object.keys(out).length ? out : null;
  };

  const tz = timeZone || process.env.GOOGLE_TIMEZONE || 'UTC';
  for (const ev of events) {
    const startStr = ev.start?.dateTime || ev.start?.date;
    if (!startStr) continue;
    const dt = new Date(startStr);
    const zoned = utcToZonedTime(dt, tz);
    const dow = getDay(zoned); // 0=Sun..6=Sat in target tz
    const dayIndex = dow === 0 ? 6 : dow - 1; // Mon..Sun => 0..6

    // Try structured parsing first (summary or description with slots)
    const bySlot = parseNamesBySlot(ev.summary) || parseNamesBySlot(ev.description);
    if (bySlot) {
      if (bySlot.morning) pushUsers(dayIndex, 0, bySlot.morning);
      if (bySlot.middle) pushUsers(dayIndex, 1, bySlot.middle);
      if (bySlot.evening) pushUsers(dayIndex, 2, bySlot.evening);
      continue;
    }

    // Next preference: attendees mapped to usernames (if usersByEmail provided)
    if (Array.isArray(ev.attendees) && usersByEmail) {
      const emails = ev.attendees.map((a) => (a.email || '').toLowerCase()).filter(Boolean);
      const usernames = emails
        .map((e) => usersByEmail[e])
        .filter(Boolean)
        .map((u) => u.username || u);
      const slot = ev.extendedProperties?.private?.slot || 'morning';
      const order = slot === 'morning' ? 0 : slot === 'middle' ? 1 : 2;
      if (usernames.length) {
        pushUsers(dayIndex, order, usernames);
        continue;
      }
    }

    // Fallback: slot from extendedProperties + names from summary (comma-separated)
    const slot = ev.extendedProperties?.private?.slot || 'morning';
    const order = slot === 'morning' ? 0 : slot === 'middle' ? 1 : 2;
    const namesFromSummary = (ev.summary || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (namesFromSummary.length) {
      pushUsers(dayIndex, order, namesFromSummary);
    }
  }

  // Ensure each day is ordered by slot then name
  schedule.forEach((day) => day.sort((a, b) => a.id.localeCompare(b.id)));
  return schedule;
}

module.exports = { listEvents, toSchedule };
