require('dotenv').config();
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const scheduler = require('./scheduler');

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
      // Interaction already expired or handled — nothing to do
    }
  }
});

client.on('error', err => console.error('Client error:', err));

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  scheduler.init(db, client);
  scheduler.reschedule();
});

client.login(process.env.BOT_TOKEN);
