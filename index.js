require("dotenv").config();

const {
Client,
GatewayIntentBits,
PermissionsBitField,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
ChannelType
} = require("discord.js");

const fs = require("fs");
const ms = require("ms");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
});

let config = {};
let db = {
xp:{},
warnings:{},
levels:{},
economy:{},
messageCount:{},
tickets:{},
bumpReminder:{},
reviveData:{},
cooldowns:{}
};

const BLUE = 0xbfdfff;
const CREAM = 0xfaf6e9;

const revivePrompts = [
"🌿 It's been a little quiet... what has everyone been up to today?",
"🍄 Tea, coffee, or cozy drink check in?",
"🌷 Tell us something small that made you smile today.",
"🧺 Anyone reading, gaming, crafting, or studying right now?",
"☁️ Drop a song you've had on repeat lately.",
"🌙 Late grove check in — how is everyone feeling?"
];

const appreciationPrompts = [
"🌼 thank you all for keeping the grove feeling warm today.",
"🍃 this little corner is always nicer when everyone chats.",
"🌷 sending a cozy appreciation hug to everyone here."
];

function loadConfig() {
if (fs.existsSync("config.json")) config = JSON.parse(fs.readFileSync("config.json","utf8"));
}

function saveConfig() {
fs.writeFileSync("config.json", JSON.stringify(config,null,2));
}

function loadDB() {
if (fs.existsSync("db.json")) db = JSON.parse(fs.readFileSync("db.json","utf8"));
}

function saveDB() {
fs.writeFileSync("db.json", JSON.stringify(db,null,2));
}

function getGuildConfig(guildId) {
if (!config[guildId]) {
config[guildId] = {
prefix: "!",
welcomeChannel: null,
modlogChannel: null,
reviveChannel: null,
bumpChannel: null,
ticketCategory: null,
autoResponses: {},
autorole: null
};
saveConfig();
}
return config[guildId];
}

function cozyEmbed(title, description, color = BLUE) {
return new EmbedBuilder()
.setColor(color)
.setTitle(title)
.setDescription(description)
.setFooter({text:"⋆｡ﾟ☁︎｡⋆｡ ﾟ☾ ﾟ｡⋆"});
}

loadConfig();
loadDB();

client.once("clientReady", () => {
console.log(`${client.user.tag} is online.`);
setInterval(() => {
for (const guildId in config) {
const guild = client.guilds.cache.get(guildId);
if (!guild) continue;
const guildConfig = getGuildConfig(guildId);

if (guildConfig.reviveChannel) {
const channel = guild.channels.cache.get(guildConfig.reviveChannel);
if (!channel) continue;

if (!db.reviveData[guildId]) db.reviveData[guildId] = {lastChat: Date.now()};
const inactive = Date.now() - db.reviveData[guildId].lastChat;

if (inactive >= 7200000) {
const prompt = revivePrompts[Math.floor(Math.random()*revivePrompts.length)];
channel.send({embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n💬 chat revive\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯", prompt, CREAM)]});
db.reviveData[guildId].lastChat = Date.now();
saveDB();
}
}
}
}, 600000);
});
client.on("guildMemberAdd", member => {
const guildConfig = getGuildConfig(member.guild.id);

if (guildConfig.autorole) {
const role = member.guild.roles.cache.get(guildConfig.autorole);
if (role) member.roles.add(role).catch(()=>{});
}

if (guildConfig.welcomeChannel) {
const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel);
if (channel) {
channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🌷 welcome to the grove\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯", `Welcome ${member} ♡ we're happy you're here.`, CREAM)]
});
}
}
});

client.on("interactionCreate", async interaction => {
if (!interaction.isButton()) return;

if (interaction.customId.startsWith("role_")) {
await interaction.deferReply({ephemeral:true});

let roleName = interaction.customId.replace("role_","").replace(/_/g," ");

const roleMap = {
sheher: "she/her",
hehim: "he/him",
theythem: "they/them",
"18to20": "18-20",
"21plus": "21+"
};

if (roleMap[roleName]) roleName = roleMap[roleName];

const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

if (!role) {
return interaction.editReply({content:"Role not found in server."});
}

const member = await interaction.guild.members.fetch(interaction.user.id);

try {
if (member.roles.cache.has(role.id)) {
await member.roles.remove(role);
return interaction.editReply({content:`🌿 Removed role: ${role.name}`});
} else {
await member.roles.add(role);
return interaction.editReply({content:`🌷 Added role: ${role.name}`});
}
} catch (err) {
console.log(err);
return interaction.editReply({content:"I couldn't manage that role. Check bot role position."});
}
}

if (interaction.customId.startsWith("ticket_")) {
const topic = interaction.customId.split("_")[1];
const guildConfig = getGuildConfig(interaction.guild.id);

const channel = await interaction.guild.channels.create({
name: `${topic}-${interaction.user.username}`.toLowerCase(),
type: ChannelType.GuildText,
parent: guildConfig.ticketCategory || null,
permissionOverwrites: [
{
id: interaction.guild.roles.everyone.id,
deny: [PermissionsBitField.Flags.ViewChannel]
},
{
id: interaction.user.id,
allow: [
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.ReadMessageHistory
]
}
]
});

db.tickets[interaction.user.id] = channel.id;
saveDB();

return interaction.reply({
content: `🌿 your ${topic} ticket has been opened: ${channel}`,
ephemeral: true
});
}
});

client.on("messageCreate", async message => {
if (message.author.bot || !message.guild) return;

const guildConfig = getGuildConfig(message.guild.id);
const prefix = guildConfig.prefix;

if (!db.xp[message.author.id]) db.xp[message.author.id] = 0;
if (!db.economy[message.author.id]) db.economy[message.author.id] = 0;
if (!db.messageCount[message.author.id]) db.messageCount[message.author.id] = 0;
if (!db.reviveData[message.guild.id]) db.reviveData[message.guild.id] = {lastChat:Date.now()};

db.xp[message.author.id] += 5;
db.economy[message.author.id] += 2;
db.messageCount[message.author.id] += 1;
db.reviveData[message.guild.id].lastChat = Date.now();
saveDB();

if (message.author.id === "302050872383242240" && message.embeds.length > 0) {
if (message.embeds[0].description && message.embeds[0].description.includes("Bump done")) {
if (guildConfig.bumpChannel) {
const bumpChan = message.guild.channels.cache.get(guildConfig.bumpChannel);
if (bumpChan) {
bumpChan.send({embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🌷 bump completed\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯", "Thank you for helping the grove grow.\nNext bump reminder in 2 hours.", BLUE)]});

setTimeout(() => {
bumpChan.send({embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🔔 bump reminder\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯", "Our next bump is ready if anyone would like to help 🌿", CREAM)]});
}, 7200000);
}
}
}
}

if (!message.content.startsWith(prefix)) {
for (const trigger in guildConfig.autoResponses) {
if (message.content.toLowerCase().includes(trigger)) {
return message.channel.send(guildConfig.autoResponses[trigger]);
}
}
return;
}

const args = message.content.slice(prefix.length).trim().split(/ +/);
const command = args.shift().toLowerCase();
if (command === "help") {
return message.channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n📖 community guidebook\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯",
"`!ping` `!balance` `!daily` `!work` `!leaderboard` `!chatlb`\n`!ticketpanel` `!setticketcategory`\n`!setrevive` `!setbumpchannel`\n`!setwelcome` `!setprefix`\n`!ban` `!kick` `!warn` `!clear`\n`!addresponse` `!addbadword`", BLUE)]
});
}

if (command === "ping") return message.channel.send("Pong 🌷");

if (command === "balance") {
return message.channel.send({embeds:[cozyEmbed("🌰 acorn pouch", `${message.author} currently has **${db.economy[message.author.id]} acorns**.`, CREAM)]});
}

if (command === "daily") {
if (!db.cooldowns[message.author.id]) db.cooldowns[message.author.id] = {};

const lastDaily = db.cooldowns[message.author.id].daily || 0;
const diff = Date.now() - lastDaily;

if (diff < 86400000) {
const hours = Math.ceil((86400000 - diff)/3600000);
return message.channel.send({embeds:[cozyEmbed("🌙 daily forage resting", `You may gather daily acorns again in about **${hours} hour(s)**.`, CREAM)]});
}

db.cooldowns[message.author.id].daily = Date.now();
db.economy[message.author.id] += 100;
saveDB();

return message.channel.send({embeds:[cozyEmbed("🌤 daily forage", `You gathered **100 acorns** today.`, BLUE)]});
}

if (command === "work") {
if (!db.cooldowns[message.author.id]) db.cooldowns[message.author.id] = {};

const lastWork = db.cooldowns[message.author.id].work || 0;
const diff = Date.now() - lastWork;

if (diff < 1800000) {
const mins = Math.ceil((1800000 - diff)/60000);
return message.channel.send({embeds:[cozyEmbed("🍂 taking a breather", `You can work again in about **${mins} minute(s)**.`, BLUE)]});
}

const earned = Math.floor(Math.random()*80)+20;
db.cooldowns[message.author.id].work = Date.now();
db.economy[message.author.id] += earned;
saveDB();

return message.channel.send({embeds:[cozyEmbed("🧺 little task completed", `You earned **${earned} acorns**.`, CREAM)]});
}

if (command === "leaderboard") {
const sorted = Object.entries(db.economy).sort((a,b)=>b[1]-a[1]).slice(0,5);
let text = sorted.map((u,i)=>`${i+1}. <@${u[0]}> — ${u[1]} acorns`).join("\n");
return message.channel.send({embeds:[cozyEmbed("🏆 top gatherers", text || "No data yet.", BLUE)]});
}

if (command === "chatlb") {
const sorted = Object.entries(db.messageCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
let text = sorted.map((u,i)=>`${i+1}. <@${u[0]}> — ${u[1]} messages`).join("\n");
return message.channel.send({embeds:[cozyEmbed("💬 most active in the grove", text || "No data yet.", CREAM)]});
}

if (command === "setrevive") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.reviveChannel = message.channel.id;
saveConfig();
return message.channel.send("Revive channel set.");
}

if (command === "unsetrevive") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.reviveChannel = null;
saveConfig();
return message.channel.send("Revive channel removed.");
}

if (command === "setbumpchannel") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.bumpChannel = message.channel.id;
saveConfig();
return message.channel.send("Bump reminder channel set.");
}

if (command === "unsetbump") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.bumpChannel = null;
saveConfig();
return message.channel.send("Bump reminder channel removed.");
}

if (command === "setticketcategory") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.ticketCategory = message.channel.parentId || null;
saveConfig();
return message.channel.send("Ticket category saved from this channel.");
}

if (command === "ticketpanel") {
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("ticket_support").setLabel("🍄 Support").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("ticket_report").setLabel("🌿 Report").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("ticket_purchase").setLabel("🧺 Purchase Help").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("ticket_partner").setLabel("🕊 Partnership").setStyle(ButtonStyle.Danger)
);

return message.channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🎫 community help desk\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯", "Choose a ticket topic below and the bot will open a private space for you.", BLUE)],
components:[row]
});
}

if (command === "closeticket") {
if (
!message.channel.name.startsWith("support-") &&
!message.channel.name.startsWith("report-") &&
!message.channel.name.startsWith("purchase-") &&
!message.channel.name.startsWith("partner-")
) return message.channel.send("This is not a ticket channel.");

await message.channel.send({
embeds:[cozyEmbed("🌙 closing ticket", "This cozy corner will close in 5 seconds.", CREAM)]
});

setTimeout(() => {
message.channel.delete().catch(()=>{});
}, 5000);

return;
}

if (command === "notifpanel") {
const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_news").setLabel("news").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_events").setLabel("events").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_vc").setLabel("vc").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_giveaway").setLabel("giveaway").setStyle(ButtonStyle.Primary)
);

const row2 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_movie_night").setLabel("movie night").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_vlogs").setLabel("vlogs").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_story_time").setLabel("story time").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_chat_revive").setLabel("chat revive").setStyle(ButtonStyle.Secondary)
);

return message.channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🔔 notification roles\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯","Choose your preferred pings below.", BLUE)],
components:[row1,row2]
});
}

if (command === "pronounpanel") {
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_sheher").setLabel("she/her").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("role_hehim").setLabel("he/him").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("role_theythem").setLabel("they/them").setStyle(ButtonStyle.Success));

return message.channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🌷 pronoun roles\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯","Select your pronouns.", CREAM)],
components:[row]
});
}

if (command === "colorpanel") {
const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_sage").setLabel("sage").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_darker_cream").setLabel("darker cream").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_mushroom").setLabel("mushroom").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_sky").setLabel("sky").setStyle(ButtonStyle.Primary)
);

const row2 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_rose").setLabel("rose").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_blood_red").setLabel("blood red").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_spring_colors").setLabel("spring colors").setStyle(ButtonStyle.Secondary)
);

return message.channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🎨 color roles\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯","Pick your cozy color.", BLUE)],
components:[row1,row2]
});
}

if (command === "aestheticpanel") {
const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_moonlit_soul").setLabel("moonlit soul").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_sunlit_soul").setLabel("sunlit soul").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_loves_nature").setLabel("loves nature").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_loves_reading").setLabel("loves reading").setStyle(ButtonStyle.Primary)
);

const row2 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_loves_baking").setLabel("loves baking").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_introvert").setLabel("introvert").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_extrovert").setLabel("extrovert").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_gaming").setLabel("gaming").setStyle(ButtonStyle.Secondary)
);

return message.channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🍄 aesthetic roles\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯","Choose little things that fit you.", CREAM)],
components:[row1,row2]
});
}

if (command === "identitypanel") {
const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_straight").setLabel("straight").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_bisexual").setLabel("bisexual").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_pansexual").setLabel("pansexual").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_gay").setLabel("gay").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("role_lesbian").setLabel("lesbian").setStyle(ButtonStyle.Primary)
);

const row2 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("role_18to20").setLabel("18-20").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("role_21plus").setLabel("21+").setStyle(ButtonStyle.Secondary))

return message.channel.send({
embeds:[cozyEmbed("╭─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╮\n🕊 identity roles\n╰─ ⋅𖥔⋅ ───────── ⋅𖥔⋅ ─╯","Optional identity selections.", BLUE)],
components:[row1,row2]
});
}

if (command === "setprefix") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.prefix = args[0];
saveConfig();
return message.channel.send(`Prefix changed to ${args[0]}`);
}

if (command === "setwelcome") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.welcomeChannel = message.channel.id;
saveConfig();
return message.channel.send("Welcome channel set.");
}
if (command === "unsetwelcome") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.welcomeChannel = null;
saveConfig();
return message.channel.send("Welcome channel removed.");
}
if (command === "addresponse") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.autoResponses[args[0].toLowerCase()] = args.slice(1).join(" ");
saveConfig();
return message.channel.send("Custom response added.");
}

if (command === "addbadword") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
guildConfig.automodWords.push(args[0].toLowerCase());
saveConfig();
return message.channel.send("Blocked phrase added.");
}

if (command === "ban") {
if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
const member = message.mentions.members.first();
if (!member) return;
await member.ban();
return message.channel.send("User banned.");
}

if (command === "kick") {
if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
const member = message.mentions.members.first();
if (!member) return;
await member.kick();
return message.channel.send("User kicked.");
}

if (command === "warn") {
const user = message.mentions.users.first();
if (!user) return;
if (!db.warnings[user.id]) db.warnings[user.id] = [];
db.warnings[user.id].push(args.slice(1).join(" "));
saveDB();
return message.channel.send("Warning logged.");
}

if (command === "clear") {
const amount = parseInt(args[0]);
await message.channel.bulkDelete(amount).catch(()=>{});
return message.channel.send("Channel tidied.").then(m=>setTimeout(()=>m.delete(),3000));
}
});

client.login(process.env.TOKEN);
