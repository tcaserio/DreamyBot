const express = require('express');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

let db;
let client;

// ─── Message builder ────────────────────────────────────────────────────────

function buildApplicationMessage(app) {
  const howFound  = JSON.parse(app.how_found);
  const responses = app.responses || [];
  const giftsGiven = app.gifts_given || {};

  const approvals   = responses.filter(r => r.action === 'approve');
  const denials     = responses.filter(r => r.action === 'deny');
  const hasApproval = approvals.length > 0;
  const hasBoth     = hasApproval && denials.length > 0;

  const fields = [
    { name: 'Character Name', value: app.in_game_name, inline: true },
    { name: 'Discord',        value: app.discord_username || 'N/A', inline: true },
    { name: 'Rules',          value: app.rules_agreed ? 'Agreed' : 'Not agreed', inline: true },
    { name: 'How they found us', value: howFound.join('\n'), inline: false },
    { name: 'How would you help a lost member?', value: app.vibe_check, inline: false },
    { name: 'Welcome Package', value: app.welcome_package || 'None', inline: false },
  ];

  // ── Response history ──
  if (responses.length > 0) {
    const responseLines = responses.map(r => {
      const icon = r.action === 'approve' ? '✅' : '❌';
      const verb = r.action === 'approve' ? 'Approved' : 'Denied';
      const ts   = `<t:${Math.floor(new Date(r.timestamp).getTime() / 1000)}:f>`;
      return `${icon} ${verb} by **${r.username}** — ${ts}`;
    });
    fields.push({
      name:  hasBoth ? '⚠️ Responses — conflicting votes, please discuss' : 'Responses',
      value: responseLines.join('\n'),
      inline: false,
    });
  }

  // ── Gift tracking (only show after at least one approval) ──
  if (hasApproval) {
    const pajamaLabel = app.welcome_package && app.welcome_package !== 'None'
      ? app.welcome_package.replace(/\s*\+.*$/, '').trim()
      : 'Pajama Set';

    const giftLines = [];
    for (const [key, label] of [['bed', 'Magicked Bed'], ['pajama', pajamaLabel], ['pillow', 'Plush Pillow Minion']]) {
      const given = giftsGiven[key];
      if (given) {
        const ts = `<t:${Math.floor(new Date(given.given_at).getTime() / 1000)}:f>`;
        giftLines.push(`✅ **${label}** — given by ${given.given_by} ${ts}`);
      } else {
        giftLines.push(`○ ${label}`);
      }
    }
    fields.push({ name: 'Welcome Package Delivery', value: giftLines.join('\n'), inline: false });
  }

  return {
    color:     0x9B8EC4,
    title:     'New FC Application',
    fields,
    timestamp: new Date(app.created_at).toISOString(),
  };
}

function buildComponents(app) {
  const rows = [];
  const responses = app.responses || [];
  const approvals = responses.filter(r => r.action === 'approve');
  const giftsGiven = app.gifts_given || {};

  // Approve / Deny row
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_approve:${app.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`app_deny:${app.id}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger),
    )
  );

  // Gift buttons row (only after at least one approval)
  if (approvals.length > 0) {
    const pajamaLabel = app.welcome_package && app.welcome_package !== 'None'
      ? app.welcome_package.replace(/\s*\+.*$/, '').trim()
      : 'Pajama Set';

    const giftRow = new ActionRowBuilder();
    for (const [key, label] of [['bed', 'Magicked Bed'], ['pajama', pajamaLabel], ['pillow', 'Plush Pillow Minion']]) {
      giftRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`app_gift_${key}:${app.id}`)
          .setLabel(giftsGiven[key] ? `✅ ${label}` : `Give ${label}`)
          .setStyle(giftsGiven[key] ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(!!giftsGiven[key])
      );
    }
    rows.push(giftRow);
  }

  return rows;
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

function init(dbInstance, clientInstance) {
  db     = dbInstance;
  client = clientInstance;

  const app = express();
  app.use(express.json());

  app.post('/application', async (req, res) => {
    try {
      // Validate secret
      const secretRow = await db.getOne(`SELECT value FROM config WHERE key = 'application_webhook_secret'`);
      const expected  = secretRow?.value;
      const provided  = req.headers['authorization'];

      if (!expected || provided !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate leadership channel is configured
      const channelRow = await db.getOne(`SELECT value FROM config WHERE key = 'applications_channel_id'`);
      if (!channelRow) {
        console.error('Application received but no applications_channel_id configured.');
        return res.status(503).json({ error: 'Applications channel not configured.' });
      }

      const {
        in_game_name,
        rules_agreed,
        how_found,
        vibe_check,
        welcome_package,
        discord_username,
      } = req.body;

      // Persist to DB
      const result = await db.getOne(
        `INSERT INTO applications
           (in_game_name, rules_agreed, how_found, vibe_check, welcome_package, discord_username)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          in_game_name,
          rules_agreed === true || rules_agreed === 'true',
          JSON.stringify(Array.isArray(how_found) ? how_found : [how_found]),
          vibe_check,
          welcome_package || null,
          discord_username || null,
        ]
      );

      const application = result;

      // Post to leadership channel
      const channel = await client.channels.fetch(channelRow.value);
      const message = await channel.send({
        embeds:     [buildApplicationMessage(application)],
        components: buildComponents(application),
      });

      // Save message reference
      await db.run(
        `UPDATE applications SET message_id = $1, channel_id = $2 WHERE id = $3`,
        [message.id, message.channelId, application.id]
      );

      res.status(200).json({ ok: true, application_id: application.id });
    } catch (err) {
      console.error('Error handling application webhook:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Application webhook server listening on port ${port}`));
}

module.exports = { init, buildApplicationMessage, buildComponents };
