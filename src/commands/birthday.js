const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Manage your birthday')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Register your birthday with the bot')
        .addIntegerOption(opt =>
          opt.setName('month')
            .setDescription('Month number (1-12)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(12)
        )
        .addIntegerOption(opt =>
          opt.setName('day')
            .setDescription('Day number (1-31)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
        )
    )
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('See your currently registered birthday')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove your birthday from the bot')
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('See all registered birthdays')
    ),

  async execute(interaction, db) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const month = interaction.options.getInteger('month');
      const day = interaction.options.getInteger('day');

      // Validate that the day is real for the given month (using a non-leap year)
      const testDate = new Date(2001, month - 1, day);
      if (testDate.getMonth() !== month - 1) {
        return interaction.reply({
          content: `That doesn't seem like a valid date. Please double-check the day for month ${month}.`,
          flags: MessageFlags.Ephemeral
        });
      }

      db.prepare(`
        INSERT INTO birthdays (user_id, username, month, day)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          username = excluded.username,
          month = excluded.month,
          day = excluded.day
      `).run(interaction.user.id, interaction.user.username, month, day);

      const monthName = new Date(2001, month - 1, 1).toLocaleString('default', { month: 'long' });
      return interaction.reply({
        content: `Your birthday has been set to **${monthName} ${day}**!`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'remove') {
      const result = db.prepare('DELETE FROM birthdays WHERE user_id = ?').run(interaction.user.id);
      if (result.changes === 0) {
        return interaction.reply({
          content: `You don't have a birthday registered.`,
          flags: MessageFlags.Ephemeral
        });
      }
      return interaction.reply({
        content: `Your birthday has been removed.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'list') {
      const rows = db.prepare(
        'SELECT * FROM birthdays ORDER BY month, day'
      ).all();

      if (!rows.length) {
        return interaction.reply({
          content: `No birthdays registered yet. Use \`/birthday set\` to add yours!`,
          flags: MessageFlags.Ephemeral
        });
      }

      let currentMonth = null;
      const lines = [];
      for (const row of rows) {
        const monthName = new Date(2001, row.month - 1, 1).toLocaleString('default', { month: 'long' });
        if (row.month !== currentMonth) {
          if (currentMonth !== null) lines.push('');
          lines.push(`**${monthName}**`);
          currentMonth = row.month;
        }
        lines.push(`${row.day} — <@${row.user_id}>`);
      }

      return interaction.reply({
        content: lines.join('\n'),
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'check') {
      const row = db.prepare('SELECT * FROM birthdays WHERE user_id = ?').get(interaction.user.id);
      if (!row) {
        return interaction.reply({
          content: `You haven't set a birthday yet. Use \`/birthday set\` to add it.`,
          flags: MessageFlags.Ephemeral
        });
      }
      const monthName = new Date(2001, row.month - 1, 1).toLocaleString('default', { month: 'long' });
      return interaction.reply({
        content: `Your registered birthday is **${monthName} ${row.day}**.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
