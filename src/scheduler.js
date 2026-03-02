const cron = require('node-cron');
const { messages, gifs } = require('./birthday-content');

function buildBirthdayMessage(userId) {
  const text = messages[Math.floor(Math.random() * messages.length)]
    .replace('{user}', `<@${userId}>`);

  if (gifs.length > 0) {
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    return { content: `${text}\n\n${gif}` };
  }

  return { content: text };
}

let task = null;
let _db = null;
let _client = null;

function init(db, client) {
  _db = db;
  _client = client;
}

function reschedule() {
  if (!_db || !_client) return;

  if (task) {
    task.stop();
    task = null;
  }

  const hourRow = _db.prepare("SELECT value FROM config WHERE key = 'birthday_hour'").get();
  const tzRow = _db.prepare("SELECT value FROM config WHERE key = 'birthday_timezone'").get();

  const hour = hourRow ? parseInt(hourRow.value) : 9;
  const timezone = tzRow ? tzRow.value : 'UTC';

  task = cron.schedule(`0 ${hour} * * *`, async () => {
    // Get the current date in the configured timezone
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(now);
    const month = parseInt(parts.find(p => p.type === 'month').value);
    const day = parseInt(parts.find(p => p.type === 'day').value);

    const birthdays = _db.prepare(
      'SELECT * FROM birthdays WHERE month = ? AND day = ?'
    ).all(month, day);

    if (!birthdays.length) return;

    const channelRow = _db.prepare("SELECT value FROM config WHERE key = 'birthday_channel_id'").get();
    if (!channelRow) {
      console.error('Birthday channel not configured. Use /config birthday-channel in your server.');
      return;
    }

    const channel = _client.channels.cache.get(channelRow.value);
    if (!channel) {
      console.error('Birthday channel not found. It may have been deleted.');
      return;
    }

    for (const birthday of birthdays) {
      await channel.send(buildBirthdayMessage(birthday.user_id));
    }
  }, { timezone });

  const displayHour = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  console.log(`Birthday announcements scheduled for ${displayHour}:00 ${ampm} (${timezone})`);
}

module.exports = { init, reschedule, buildBirthdayMessage };
