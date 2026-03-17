# Map Party Sign-Up Feature

## Overview
A `/maps` command that creates a sign-up post for treasure map sessions. Handles confirmed, tentative, and lead signups. Surfaces light warnings to aid coordination without over-automating it.

## Command
```
/maps time:<time> note:<optional>
```
Example: `/maps time:Saturday 7:30pm note:Endwalker maps`

## Sign-Up Message

Posted in the designated maps/events channel. Contains an embed and four buttons.

**Buttons**
- ✅ Sign Up
- 🤔 Tentative
- ⭐ Sign Up as Lead
- ❌ Cancel

**Embed Display**
```
🗺️ Treasure Map Party — Saturday 7:30pm
━━━━━━━━━━━━━━━━━━━━
⭐ Leads:    Trevo
✅ Confirmed: Trevo, Mira, Kael (3/8)
🤔 Tentative: Yuna, Sol
```

## Rules & Warnings

| Condition | Bot Behavior |
|---|---|
| No lead signed up | Show ⚠️ "No lead yet!" warning on embed |
| Confirmed signups reach 8 | Show ⚠️ "Getting full — may need a second lead!" warning |
| User clicks a second signup button | Replaces their previous status silently |

Tentative signups do not count toward the 8-person warning.

## Data to Store (DB)

```
map_parties
  id
  message_id        — for editing the embed on each signup change
  channel_id
  scheduled_time
  note
  created_by        — Discord user ID
  signups           — JSON: [{ user_id, username, status: "confirmed|tentative|lead" }]
  created_at
```

## Out of Scope
- Native Discord event creation (can be done manually if desired)
- Automatic party splitting or draft assignment — leads coordinate in chat
- Slot enforcement — bot warns at 8 but does not block additional signups
