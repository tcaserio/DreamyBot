// Randomly picked message for birthday announcements.
// Use {user} where you want the Discord mention to appear.
const messages = [
  `Happy Birthday {user}! 🎂 Hope your day is as wonderful as you are!`,
  `It's {user}'s birthday today! 🎉 Wishing you all the best!`,
  `Everyone wish {user} a happy birthday! 🥳 Hope it's a great one!`,
  `A very happy birthday to {user}! 🎁 May your day be full of joy!`,
  `Cheers to {user} on their special day! 🎊 Happy Birthday!`,
];

// GIF URLs to display with birthday announcements.
// Paste your GIF URLs here — Discord will display them automatically.
// To find a URL: open a GIF on Tenor or Giphy, right-click → Copy image address.
// Leave this array empty to send text-only announcements.
const gifs = [
  'https://tenor.com/view/namazu-ffxiv-ff14-dancing-final-fantasy-gif-16715249',
  'https://tenor.com/view/pokemon-happy-birthday-togepi-pikachu-gif-24350194',
  'https://tenor.com/view/happy-birthday-anya-spy-x-family-gif-1300526479044624702',
  'https://tenor.com/view/burger-eating-frieren-frieren-beyond-journey%27s-end-sousou-no-frieren-gif-22821570668236283',
];

module.exports = { messages, gifs };
