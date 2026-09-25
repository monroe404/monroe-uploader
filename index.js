const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  ChannelType
} = require("discord.js");

const {
  PORT,
  GUILD_ID
} = require("./config");

const {
  sendUploadedFile
} = require("./features/upload");

// ========================================
// EXPRESS
// ========================================

const app = express();

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// ========================================
// MULTER
// ========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

// ========================================
// DISCORD
// ========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// ========================================
// CHANNEL LIST
// ========================================

app.get(
  "/channels",
  async (req, res) => {

    try {

      const guild =
        await client.guilds.fetch(
          GUILD_ID
        );

      if (!guild) {
        return res.status(404).json({
          success: false,
          message:
            "Server tidak ditemukan."
        });
      }

      const channels =
        await guild.channels.fetch();

      const result =
        channels
          .filter(channel =>
            channel &&
            (
              channel.type ===
                ChannelType.GuildText ||

              channel.type ===
                ChannelType.GuildAnnouncement
            )
          )
          .map(channel => ({
            id: channel.id,
            name: channel.name
          }))
          .sort((a, b) =>
            a.name.localeCompare(
              b.name
            )
          );

      res.json({
        success: true,
        channels: result
      });

    } catch (error) {

      console.error(
        "Channel Error:",
        error
      );

      res.status(500).json({
        success: false,
        message: error.message
      });

    }

  }
);

// ========================================
// UPLOAD
// ========================================

app.post(
  "/upload",

  upload.array(
    "files",
    20
  ),

  async (req, res) => {

    try {

      const files =
        req.files || [];

      const channelId =
        req.body.channelId;

      const credits =
        req.body.credits || "";

      const description =
        req.body.description || "";

      let proofLinks =
        req.body.proofLinks || [];

      // ==================================
      // NORMALIZE PROOF LINKS
      // ==================================

      if (
        !Array.isArray(proofLinks)
      ) {
        proofLinks = [
          proofLinks
        ];
      }

      proofLinks =
        proofLinks
          .map(link =>
            String(link).trim()
          )
          .filter(Boolean);

      // ==================================
      // VALIDATION
      // ==================================

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message:
            "Channel belum dipilih."
        });
      }

      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "File belum dipilih."
        });
      }

      // ==================================
      // CHECK CHANNEL
      // ==================================

      const channel =
        await client.channels.fetch(
          channelId
        );

      if (!channel) {
        return res.status(404).json({
          success: false,
          message:
            "Channel tidak ditemukan."
        });
      }

      if (!channel.isTextBased()) {
        return res.status(400).json({
          success: false,
          message:
            "Channel bukan text channel."
        });
      }

      // ==================================
      // SEND
      // ==================================

      const message =
        await sendUploadedFile({
          client,
          channelId,
          files,
          credits,
          description,
          proofLinks
        });

      // ==================================
      // RESPONSE
      // ==================================

      res.json({
        success: true,
        messageId: message.id,

        files:
          files.map(
            file =>
              file.originalname
          ),

        proofUrls:
          proofLinks
      });

    } catch (error) {

      console.error(
        "Upload Error:",
        error
      );

      res.status(500).json({
        success: false,
        message: error.message
      });

    }

  }
);

// ========================================
// HOME
// ========================================

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);

// ========================================
// WEB SERVER
// ========================================

app.listen(
  PORT,
  () => {

    console.log(
      `🌐 Web uploader berjalan di port ${PORT}`
    );

  }
);

// ========================================
// DISCORD READY
// ========================================

client.once(
  "ready",
  () => {

    console.log(
      `🤖 Bot login sebagai ${client.user.tag}`
    );

    console.log(
      `🏠 Guild ID: ${GUILD_ID}`
    );

  }
);

// ========================================
// LOGIN
// ========================================

client.login(
  process.env.DISCORD_TOKEN
);