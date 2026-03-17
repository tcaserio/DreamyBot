# Member Onboarding Feature

## Overview
Automates the notification and approval layer for new FC applicants, bridging the gap between a Google Form application and Discord. Keeps a human approval step intact for vibe-checking applicants before they join.

## Current Pain Points
- Google Form submissions notify via email, pulling leadership out of Discord
- Approval discussion is scattered across DMs and leadership chat
- Generating and sending a Discord invite is manual after approval
- No central tracking of where an applicant is in the process

## Full Flow

### Step 1: Application Submitted (Google Form → Discord)
Applicant fills out the Google Form. A Google Apps Script webhook fires on submission and posts the application to the leadership channel via Discord webhook.

**Leadership channel post:**
```
📋 New FC Application
━━━━━━━━━━━━━━━━━━━━
Character Name:   [name]
Home World:       [server]
How'd you find us? [answer]
Tell us about yourself: [answer]
[Vibe check question]: [answer]
Discord Username: [username]

[✅ Approve]  [❌ Deny]
```

No email check required. Leadership can read, discuss, and act entirely within Discord.

---

### Step 2: Approval Decision

**On Approve:**
- Bot generates a single-use, 24-hour Discord invite link
- Bot posts in leadership channel:
  ```
  ✅ Approved by [leader]
  🔗 Invite link (1 use, expires 24hrs): discord.gg/xxxx
  ```
- Leadership sends the link to the applicant through whatever channel they've been in contact (Discord DM, email, etc.)
- Bot marks application as `pending_join` in DB and starts a 48-hour timeout

**On Deny:**
- Bot posts in leadership channel: `❌ Application denied by [leader]`
- Bot marks application as `denied` in DB
- No action taken toward the applicant — leadership handles communication if needed

---

### Step 3: Applicant Joins Discord

When a new member joins the server:
- Bot auto-assigns the **Awakened** (provisional) role
- Bot DMs the new member a welcome message explaining:
  - They have provisional access
  - Next steps (in-game FC invite, full member role)
- Bot posts in leadership channel:
  ```
  👋 [Discord username] just joined — who can send the in-game FC invite?
  ```
- Bot matches the join against any `pending_join` applications and links them if username matches

---

### Step 4: In-Game Invite (Manual — Bot Cannot Automate)
A leader must be online in FFXIV at the same time as the new member to send the in-game FC invite. The bot surfaces this need in the leadership channel but cannot automate it.

---

### Step 5: Full Member Promotion
Once the in-game invite is sent and they're settled in, leadership manually promotes them from **Awakened** to **Destined** via Discord roles. Bot could optionally:
- Detect the role change and post a welcome announcement in a public channel
- DM the new member congratulating them on full membership

---

## Data to Store (DB)

```
applications
  id
  character_name
  home_world
  discord_username       — self-reported, used loosely for matching
  form_responses         — JSON of all form answers
  status                 — pending | approved | denied | joined | completed
  approved_by            — Discord user ID of leader who approved
  invite_code            — generated Discord invite code
  invite_expires_at
  discord_member_id      — set when they actually join the server
  created_at
  updated_at
```

---

## Technical Notes

- **Google Apps Script webhook** — set up once on the Google Form's linked Sheet. On form submit, sends a POST request to a Discord webhook URL with form field values.
- **Discord invite generation** — `guild.invites.create(channel, { maxUses: 1, maxAge: 86400 })`. Channel should be a neutral entry-point channel.
- **New member detection** — `guildMemberAdd` event in discord.js. Triggers role assignment and leadership ping automatically.
- **Bot DMs to new members** — works because the member has just joined the server, making them reachable by the bot.

---

## Out of Scope
- Automating the in-game FC invite (requires two people online simultaneously, no FFXIV API available)
- Auto-DM'ing the invite link to the applicant before they join (bot cannot DM users it hasn't interacted with)
- Reading or processing email notifications
