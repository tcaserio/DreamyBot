require('dotenv').config();
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { init, getOne, getAll, run } = require('./database');
const scheduler = require('./scheduler');

const db = { getOne, getAll, run };

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
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

client.on('error', err => console.error('Client error:', err));

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  scheduler.init(db, client);
  scheduler.reschedule();
});

// Connect to DB then start bot
init()
  .then(() => client.login(process.env.BOT_TOKEN))
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
