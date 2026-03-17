const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const scheduler = require('../scheduler');

function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function formatHour(hour) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:00 ${ampm}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Bot configuration (moderators only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('birthday-channel')
        .setDescription('Set the channel where birthday announcements are posted')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The announcement channel')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('birthday-time')
        .setDescription('Set the hour birthday announcements are sent (uses configured timezone)')
        .addIntegerOption(opt =>
          opt.setName('hour')
            .setDescription('Hour in 24h format (0 = midnight, 9 = 9 AM, 13 = 1 PM, etc.)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(23)
        )
    )
    .addSubcommand(sub =>
      sub.setName('birthday-timezone')
        .setDescription('Set the timezone for birthday announcements')
        .addStringOption(opt =>
          opt.setName('timezone')
            .setDescription('IANA timezone (e.g. America/New_York, America/Los_Angeles, Europe/London, Asia/Tokyo)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('applications-channel')
        .setDescription('Set the channel where FC application cards are posted for leadership review')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The leadership channel')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('awakened-role')
        .setDescription('Set the provisional role auto-assigned when a new member joins the server')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The Awakened (provisional) role')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('application-secret')
        .setDescription('Set the shared secret used to authenticate incoming application webhooks')
        .addStringOption(opt =>
          opt.setName('secret')
            .setDescription('The secret token (must match APPLICATION_WEBHOOK_SECRET on the bot)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show current bot configuration')
    )
    .addSubcommand(sub =>
      sub.setName('test-birthday')
        .setDescription('Trigger a test birthday announcement right now to verify everything is working')
    )
    .addSubcommand(sub =>
      sub.setName('remove-birthday')
        .setDescription("Remove another member's registered birthday")
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The member whose birthday to remove')
            .setRequired(true)
        )
    ),

  async execute(interaction, db) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'birthday-channel') {
      const channel = interaction.options.getChannel('channel');
      await db.run(
        `INSERT INTO config (key, value) VALUES ('birthday_channel_id', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [channel.id]
      );
      return interaction.reply({
        content: `Birthday announcements will now be posted in ${channel}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'birthday-time') {
      const hour = interaction.options.getInteger('hour');
      await db.run(
        `INSERT INTO config (key, value) VALUES ('birthday_hour', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [hour.toString()]
      );
      scheduler.reschedule();
      return interaction.reply({
        content: `Birthday announcements will now be sent at **${formatHour(hour)}**.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'birthday-timezone') {
      const timezone = interaction.options.getString('timezone');
      if (!isValidTimezone(timezone)) {
        return interaction.reply({
          content: `**${timezone}** isn't a valid timezone. Use an IANA timezone name like:\n- \`America/New_York\`\n- \`America/Los_Angeles\`\n- \`America/Chicago\`\n- \`Europe/London\`\n- \`Asia/Tokyo\``,
          flags: MessageFlags.Ephemeral
        });
      }
      await db.run(
        `INSERT INTO config (key, value) VALUES ('birthday_timezone', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [timezone]
      );
      scheduler.reschedule();
      return interaction.reply({
        content: `Timezone set to **${timezone}**.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'applications-channel') {
      const channel = interaction.options.getChannel('channel');
      await db.run(
        `INSERT INTO config (key, value) VALUES ('applications_channel_id', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [channel.id]
      );
      return interaction.reply({
        content: `FC applications will now be posted in ${channel}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'awakened-role') {
      const role = interaction.options.getRole('role');
      await db.run(
        `INSERT INTO config (key, value) VALUES ('awakened_role_id', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [role.id]
      );
      return interaction.reply({
        content: `New members will automatically receive the **${role.name}** role when they join.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'application-secret') {
      const secret = interaction.options.getString('secret');
      await db.run(
        `INSERT INTO config (key, value) VALUES ('application_webhook_secret', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [secret]
      );
      return interaction.reply({
        content: `Application webhook secret updated.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'test-birthday') {
      const channelRow = await db.getOne(
        `SELECT value FROM config WHERE key = 'birthday_channel_id'`
      );
      if (!channelRow) {
        return interaction.reply({
          content: `No birthday channel set. Use \`/config birthday-channel\` first.`,
          flags: MessageFlags.Ephemeral
        });
      }
      const channel = interaction.client.channels.cache.get(channelRow.value);
      if (!channel) {
        return interaction.reply({
          content: `The configured birthday channel no longer exists. Please set a new one with \`/config birthday-channel\`.`,
          flags: MessageFlags.Ephemeral
        });
      }
      await channel.send(scheduler.buildBirthdayMessage(interaction.user.id));
      return interaction.reply({
        content: `Test announcement sent to ${channel}!`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'remove-birthday') {
      const user = interaction.options.getUser('user');
      const result = await db.run(
        'DELETE FROM birthdays WHERE user_id = $1',
        [user.id]
      );
      if (result.rowCount === 0) {
        return interaction.reply({
          content: `${user} doesn't have a birthday registered.`,
          flags: MessageFlags.Ephemeral
        });
      }
      return interaction.reply({
        content: `Birthday removed for ${user}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'show') {
      const [channelRow, hourRow, tzRow, appChannelRow, awakenedRoleRow, appSecretRow] = await Promise.all([
        db.getOne(`SELECT value FROM config WHERE key = 'birthday_channel_id'`),
        db.getOne(`SELECT value FROM config WHERE key = 'birthday_hour'`),
        db.getOne(`SELECT value FROM config WHERE key = 'birthday_timezone'`),
        db.getOne(`SELECT value FROM config WHERE key = 'applications_channel_id'`),
        db.getOne(`SELECT value FROM config WHERE key = 'awakened_role_id'`),
        db.getOne(`SELECT value FROM config WHERE key = 'application_webhook_secret'`),
      ]);

      const channelText    = channelRow    ? `<#${channelRow.value}>`         : 'not set';
      const hour           = hourRow       ? parseInt(hourRow.value)           : 9;
      const timezone       = tzRow         ? tzRow.value                       : 'UTC';
      const appChannelText = appChannelRow ? `<#${appChannelRow.value}>`       : 'not set';
      const awakenedText   = awakenedRoleRow ? `<@&${awakenedRoleRow.value}>` : 'not set';
      const secretText     = appSecretRow  ? '`[set]`'                        : 'not set';

      return interaction.reply({
        content: [
          '**Dreamy Bot Config**',
          '',
          '**Birthdays**',
          `Channel: ${channelText}`,
          `Announcement time: ${formatHour(hour)}`,
          `Timezone: ${timezone}`,
          '',
          '**FC Applications**',
          `Leadership channel: ${appChannelText}`,
          `Awakened role: ${awakenedText}`,
          `Webhook secret: ${secretText}`,
        ].join('\n'),
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
