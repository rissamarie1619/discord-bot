require("dotenv").config();
const {
Client,
GatewayIntentBits,
PermissionsBitField,
EmbedBuilder
} = require("discord.js");

const fs = require("fs");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildVoiceStates
]
});

let config = {};
let db = { xp:{}, warnings:{}, levels:{} };

function loadConfig() {
if (fs.existsSync("config.json")) {
config = JSON.parse(fs.readFileSync("config.json","utf8"));
}
}

function saveConfig() {
fs.writeFileSync("config.json", JSON.stringify(config,null,2));
}

function loadDB() {
if (fs.existsSync("db.json")) {
db = JSON.parse(fs.readFileSync("db.json","utf8"));
}
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
autoResponses: {},
automodWords: ["badword"],
autorole: null
};
saveConfig();
}
return config[guildId];
}

loadConfig();
loadDB();

client.once("clientReady", () => {
console.log(`${client.user.tag} is online.`);
});

client.on("guildMemberAdd", member => {
const guildConfig = getGuildConfig(member.guild.id);

if (guildConfig.autorole) {
const role = member.guild.roles.cache.get(guildConfig.autorole);
if (role) member.roles.add(role).catch(()=>{});
}

if (guildConfig.welcomeChannel) {
const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel);
if (channel) channel.send(`Welcome ${member} to the server!`);
}
});

client.on("messageCreate", async message => {
if (message.author.bot || !message.guild) return;

const guildConfig = getGuildConfig(message.guild.id);
const prefix = guildConfig.prefix;

if (!db.xp[message.author.id]) db.xp[message.author.id] = 0;
db.xp[message.author.id] += 5;
saveDB();

for (const word of guildConfig.automodWords) {
if (message.content.toLowerCase().includes(word)) {
message.delete().catch(()=>{});
return message.channel.send(`${message.author}, that word is blocked.`);
}
}

if (message.content.startsWith(prefix)) {
const args = message.content.slice(prefix.length).trim().split(/ +/);
const command = args.shift().toLowerCase();

if (command === "help") {
const embed = new EmbedBuilder()
.setTitle("Bot Commands")
.setDescription(`
**Moderation**
!ban @user reason
!kick @user reason
!timeout @user minutes
!warn @user reason
!warnings @user
!clear amount

**Config**
!setprefix symbol
!setwelcome
!setmodlog
!autorole @role
!addresponse trigger response
!delresponse trigger
!addbadword word

**Utility**
!ping
!userinfo @user
!serverinfo
!avatar @user
!say message

**Fun**
!coinflip
!8ball question

**XP**
!rank
`)
.setFooter({text:"Ultimate Discord Bot"});
return message.channel.send({embeds:[embed]});
}

if (command === "ping") {
return message.channel.send("Pong!");
}

if (command === "setprefix") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.channel.send("Admin only.");
guildConfig.prefix = args[0];
saveConfig();
return message.channel.send(`Prefix changed to ${args[0]}`);
}

if (command === "setwelcome") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.channel.send("Admin only.");
guildConfig.welcomeChannel = message.channel.id;
saveConfig();
return message.channel.send("Welcome channel set.");
}

if (command === "setmodlog") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.channel.send("Admin only.");
guildConfig.modlogChannel = message.channel.id;
saveConfig();
return message.channel.send("Modlog channel set.");
}

if (command === "autorole") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.channel.send("Admin only.");
const role = message.mentions.roles.first();
if (!role) return message.channel.send("Mention a role.");
guildConfig.autorole = role.id;
saveConfig();
return message.channel.send("Autorole set.");
}

if (command === "addresponse") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.channel.send("Admin only.");
const trigger = args[0].toLowerCase();
const response = args.slice(1).join(" ");
guildConfig.autoResponses[trigger] = response;
saveConfig();
return message.channel.send(`Added response for ${trigger}`);
}

if (command === "delresponse") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.channel.send("Admin only.");
delete guildConfig.autoResponses[args[0].toLowerCase()];
saveConfig();
return message.channel.send("Deleted auto response.");
}

if (command === "addbadword") {
if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.channel.send("Admin only.");
guildConfig.automodWords.push(args[0].toLowerCase());
saveConfig();
return message.channel.send("Blocked word added.");
}

if (command === "ban") {
if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
return message.channel.send("No permission.");
const member = message.mentions.members.first();
if (!member) return message.channel.send("Mention user.");
await member.ban({reason: args.slice(1).join(" ") || "No reason"});
return message.channel.send("User banned.");
}

if (command === "kick") {
if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
return message.channel.send("No permission.");
const member = message.mentions.members.first();
if (!member) return message.channel.send("Mention user.");
await member.kick(args.slice(1).join(" ") || "No reason");
return message.channel.send("User kicked.");
}

if (command === "timeout") {
if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
return message.channel.send("No permission.");
const member = message.mentions.members.first();
const mins = parseInt(args[1]);
if (!member) return message.channel.send("Mention user.");
await member.timeout(mins * 60000);
return message.channel.send(`Timed out for ${mins} minutes.`);
}

if (command === "warn") {
if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
return message.channel.send("No permission.");
const member = message.mentions.users.first();
if (!member) return message.channel.send("Mention user.");
if (!db.warnings[member.id]) db.warnings[member.id] = [];
db.warnings[member.id].push(args.slice(1).join(" "));
saveDB();
return message.channel.send("User warned.");
}

if (command === "warnings") {
const member = message.mentions.users.first();
if (!member) return message.channel.send("Mention user.");
const warns = db.warnings[member.id] || [];
return message.channel.send(`${member.tag} warnings:\n${warns.join("\n") || "None"}`);
}

if (command === "clear") {
if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
return message.channel.send("No permission.");
const amount = parseInt(args[0]);
await message.channel.bulkDelete(amount);
return message.channel.send(`Deleted ${amount} messages.`).then(m=>setTimeout(()=>m.delete(),3000));
}

if (command === "userinfo") {
const user = message.mentions.users.first() || message.author;
return message.channel.send(`User: ${user.tag}\nID: ${user.id}`);
}

if (command === "serverinfo") {
return message.channel.send(`Server: ${message.guild.name}\nMembers: ${message.guild.memberCount}`);
}

if (command === "avatar") {
const user = message.mentions.users.first() || message.author;
return message.channel.send(user.displayAvatarURL({dynamic:true,size:1024}));
}

if (command === "say") {
return message.channel.send(args.join(" "));
}

if (command === "coinflip") {
return message.channel.send(Math.random() < 0.5 ? "Heads" : "Tails");
}

if (command === "8ball") {
const responses = ["Yes","No","Maybe","Probably","Definitely"];
return message.channel.send(responses[Math.floor(Math.random()*responses.length)]);
}

if (command === "rank") {
const points = db.xp[message.author.id] || 0;
return message.channel.send(`${message.author}, XP: ${points}`);
}
}

for (const trigger in guildConfig.autoResponses) {
if (message.content.toLowerCase().includes(trigger)) {
return message.channel.send(guildConfig.autoResponses[trigger]);
}
}
});

client.login(process.env.TOKEN);
