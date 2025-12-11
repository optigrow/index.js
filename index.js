// ========================
// IMPORTS
// ========================
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const express = require("express");

// ========================
// CORE CONFIG
// ========================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // keep token in env for security
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || null; // optional email via Zapier

// Hard-wired for OptiGrow Discord
const BUSINESS_NAME = "OptiGrow";
const GUILD_ID = "1308790381130944552";
const STAFF_ROLE_ID = "1448791779305590987";
const START_HERE_CHANNEL_ID = "1308792753890525255";

// Team Members (OptiGrow)
const FOUNDER1_USER_ID = "1267524002415513745"; // Founder 1
const FOUNDER2_USER_ID = "1296561406518231134"; // Founder 2

const CSM1_USER_ID = "1018939468763373589";
const CSM2_USER_ID = "1322178805359706213";
const CSM3_USER_ID = "775132202022600724";

const FULFILMENT_USER_ID = "298481566932402178";
const OPERATIONS_USER_ID = "754074867426525354";

// ========================
// EXPRESS SERVER FOR ZAPIER (INVITE MAP)
// ========================
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// inviteCode → firstname
const inviteMap = new Map();

// simple check
app.get("/", (req, res) => {
  res.send(`${BUSINESS_NAME} Discord Bot is running.`);
});

// Zapier posts inviteCode + firstname here
app.post("/invite-map", (req, res) => {
  const { inviteCode, firstname } = req.body;

  if (!inviteCode || !firstname) {
    return res.status(400).send("inviteCode and firstname required");
  }

  inviteMap.set(inviteCode, firstname);
  console.log(`Mapped ${inviteCode} → ${firstname}`);

  return res.send("ok");
});

app.listen(PORT, () => {
  console.log("HTTP server listening on port " + PORT);
});

// ========================
// DISCORD BOT SETUP
// ========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
});

// Track invite usage
const inviteUses = new Map();

// ========================
// READY EVENT
// ========================
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    if (!guild) {
      console.log("⚠ No guild found. Invite caching skipped.");
      return;
    }

    const invites = await guild.invites.fetch();
    invites.forEach(inv => inviteUses.set(inv.code, inv.uses));

    console.log("Cached existing invites.");
  } catch (err) {
    console.error("Error caching invites:", err);
  }
});

// ========================
// MEMBER JOIN EVENT
// ========================
client.on("guildMemberAdd", async (member) => {
  try {
    const guild = member.guild;
    const newInvites = await guild.invites.fetch();

    // Detect which invite was used
    let usedInvite = null;

    newInvites.forEach(inv => {
      const prev = inviteUses.get(inv.code) || 0;
      if (inv.uses > prev) {
        usedInvite = inv;
      }
      inviteUses.set(inv.code, inv.uses);
    });

    let firstname;

    if (usedInvite) {
      const inviteCode = usedInvite.code;
      firstname = inviteMap.get(inviteCode);

      if (!firstname) {
        console.log(`⚠ No firstname mapped for invite ${inviteCode}, falling back to displayName.`);
        firstname = member.displayName || member.user.username || "Client";
      } else {
        console.log(`Invite ${usedInvite.code} matched to firstname: ${firstname}`);
      }
    } else {
      console.log(`⚠ Could not find used invite for ${member.user.tag}, falling back to displayName.`);
      firstname = member.displayName || member.user.username || "Client";
    }

    firstname = firstname.trim();
    const categoryName = `${firstname} - ${BUSINESS_NAME}`;
    console.log(`Creating channels for: ${firstname}`);

    // ========================
    // CREATE CATEGORY
    // ========================
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory
    });

    // Permission rules
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      },
      {
        // allow the bot itself
        id: client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      }
    ];

    if (STAFF_ROLE_ID) {
      overwrites.push({
        id: STAFF_ROLE_ID,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      });
    }

    await category.permissionOverwrites.set(overwrites);

    // ========================
    // CREATE CHANNELS
    // ========================
    const channelNames = [
      "🤝│team-chat",
      "🚀│launch-tracking",
      "🎯│campaigns",
      "📞│appointments",
      "🛠│systems",
      "📚│resources"
    ];

    let teamChatChannel = null;

    for (const name of channelNames) {
      const createdChannel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category.id
      });

      if (name.includes("team-chat")) {
        teamChatChannel = createdChannel;
      }
    }

    // ========================
    // SEND ONBOARDING MESSAGE (ONE MESSAGE)
    // ========================
    if (teamChatChannel) {
      const newMemberMention = `<@${member.id}>`;

      const founder1 = `<@${FOUNDER1_USER_ID}>`;
      const founder2 = `<@${FOUNDER2_USER_ID}>`;

      const csm1 = `<@${CSM1_USER_ID}>`;
      const csm2 = `<@${CSM2_USER_ID}>`;
      const csm3 = `<@${CSM3_USER_ID}>`;

      const fulfilment = `<@${FULFILMENT_USER_ID}>`;
      const operations = `<@${OPERATIONS_USER_ID}>`;
      const startHere = `<#${START_HERE_CHANNEL_ID}>`;

      const message = `
✨ **Welcome to ${BUSINESS_NAME}!**

Hey ${newMemberMention}, welcome aboard.  
You’ve just plugged into a team that lives and breathes performance, systems, and predictable growth.

From here, we’ll work with you to optimise your offer, build and refine your funnel, launch winning campaigns, and put the right automation in place so growth becomes repeatable — not random. You’re not just “working with an agency” — you’ve got an optimisation partner.

⸻

👥 **Your OptiGrow Team**

${founder1} & ${founder2} – **Co-Founders / Growth Strategy**  
Set the strategic direction, positioning, and high-level growth plan for your account.

${csm1}, ${csm2} & ${csm3} – **Client Success Team**  
Your day-to-day partners. If you need clarity, priorities, or help unblocking something fast, they’re your first ping.

${fulfilment} – **Fulfilment Lead**  
Oversees creatives, funnels, tracking, and ad implementation to make sure what we launch is sharp and aligned with your goals.

${operations} – **Operations & Systems**  
Keeps your onboarding, assets, and workflows organised so everything feels clean and under control behind the scenes.

**Creative & Tech Support**  
Handles builds, edits, integrations, tracking, and ongoing optimisations.

⸻

📌 **How to use this space**

- Use **🤝│team-chat** for updates, questions, and async check-ins  
- Track launches in **🚀│launch-tracking**  
- Review and discuss **🎯│campaigns** and performance  
- Coordinate calls and bookings in **📞│appointments**  
- Keep tech, automations, and integrations in **🛠│systems**  
- Store important docs, links, and assets in **📚│resources**

⸻

**Next step:** Head over to ${startHere} and complete your intake form.  
That gives us the data we need to prioritise your setup and start optimising quickly.

We’re pumped to build something scalable with you. 🚀
      `.trim();

      await teamChatChannel.send(message);
    }

    // ========================
    // NOTIFY ZAPIER FOR EMAIL
    // ========================
    if (ZAPIER_WEBHOOK_URL) {
      try {
        const payload = {
          firstname,
          discordTag: `${member.user.username}#${member.user.discriminator}`,
          discordId: member.id,
          categoryName,
          joinedAt: new Date().toISOString()
        };

        await fetch(ZAPIER_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        console.log("Notified Zapier about new member join.");
      } catch (err) {
        console.error("Error notifying Zapier:", err);
      }
    } else {
      console.log("ZAPIER_WEBHOOK_URL not set, skipping email webhook.");
    }

    console.log(`Created category + channels for ${firstname}`);
  } catch (err) {
    console.error("Error in guildMemberAdd:", err);
  }
});

// ========================
// LOGIN BOT
// ========================
client.login(DISCORD_TOKEN);
