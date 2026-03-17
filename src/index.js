require('dotenv').config();
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { init, getOne, getAll, run } = require('./database');
const { deployCommands } = require('./deploy-commands');
const scheduler = require('./scheduler');
const applications = require('./applications');

const db = { getOne, getAll, run };

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, db);
  } catch (err) {
    console.error(err);
    const msg = { content: 'Something went wrong running that command.', flags: MessageFlags.Ephemeral };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch {
      // Interaction already expired or handled
    }
  }
});

async function handleButton(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('app_approve:') || customId.startsWith('app_deny:')) {
    const action = customId.startsWith('app_approve:') ? 'approve' : 'deny';
    const appId  = customId.split(':')[1];

    const app = await db.getOne('SELECT * FROM applications WHERE id = $1', [appId]);
    if (!app) {
      return interaction.reply({ content: 'Application not found.', flags: MessageFlags.Ephemeral });
    }

    const responses = app.responses || [];
    responses.push({
      user_id:   interaction.user.id,
      username:  interaction.user.displayName || interaction.user.username,
      action,
      timestamp: new Date().toISOString(),
    });

    await db.run(
      'UPDATE applications SET responses = $1 WHERE id = $2',
      [JSON.stringify(responses), appId]
    );

    const updated = await db.getOne('SELECT * FROM applications WHERE id = $1', [appId]);
    await interaction.update({
      content:    applications.buildApplicationMessage(updated),
      components: applications.buildComponents(updated),
    });
    return;
  }

  if (customId.startsWith('app_gift_')) {
    const [prefixed, appId] = customId.split(':');
    const giftKey = prefixed.replace('app_gift_', ''); // bed | pajama | pillow

    const app = await db.getOne('SELECT * FROM applications WHERE id = $1', [appId]);
    if (!app) {
      return interaction.reply({ content: 'Application not found.', flags: MessageFlags.Ephemeral });
    }

    const giftsGiven = app.gifts_given || {};
    if (giftsGiven[giftKey]) {
      return interaction.reply({ content: 'That item is already marked as given.', flags: MessageFlags.Ephemeral });
    }

    giftsGiven[giftKey] = {
      given_by: interaction.user.displayName || interaction.user.username,
      given_at: new Date().toISOString(),
    };

    await db.run(
      'UPDATE applications SET gifts_given = $1 WHERE id = $2',
      [JSON.stringify(giftsGiven), appId]
    );

    const updated = await db.getOne('SELECT * FROM applications WHERE id = $1', [appId]);
    await interaction.update({
      content:    applications.buildApplicationMessage(updated),
      components: applications.buildComponents(updated),
    });
    return;
  }
}

// Auto-assign Awakened role on member join
client.on('guildMemberAdd', async member => {
  try {
    const roleRow = await db.getOne(`SELECT value FROM config WHERE key = 'awakened_role_id'`);
    if (!roleRow) return;
    const role = member.guild.roles.cache.get(roleRow.value);
    if (!role) return;
    await member.roles.add(role);
  } catch (err) {
    console.error('Failed to assign Awakened role:', err);
  }
});

client.on('error', err => console.error('Client error:', err));

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  scheduler.init(db, client);
  scheduler.reschedule();
  applications.init(db, client);
});

// Connect to DB, deploy commands, then start bot
init()
  .then(() => {
    console.log('Database initialized.');
    return deployCommands();
  })
  .then(() => client.login(process.env.BOT_TOKEN))
  .catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
