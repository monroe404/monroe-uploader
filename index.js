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
  uploadProofs,
  sendUploadedFile
} = require("./features/upload");

// =========================
// EXPRESS
// =========================

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// =========================
// UPLOAD STORAGE
// =========================

const upload = multer({
  dest: path.join(__dirname, "uploads"),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// =========================
// GET CHANNELS
// =========================

app.get("/channels", async (req, res) => {
  try {
    const guild =
      await client.guilds.fetch(GUILD_ID);

    if (!guild) {
      return res.status(404).json({
        success: false,
        message: "Server tidak ditemukan."
      });
    }

    const channels =
      await guild.channels.fetch();

    const result =
      channels
        .filter(channel =>
          channel &&
          (
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement
          )
        )
        .map(channel => ({
          id: channel.id,
          name: channel.name
        }))
        .sort((a, b) =>
          a.name.localeCompare(b.name)
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
});

// =========================
// UPLOAD
// =========================

app.post(
  "/upload",
  upload.fields([
    {
      name: "files",
      maxCount: 20
    },
    {
      name: "proofFiles",
      maxCount: 20
    }
  ]),
  async (req, res) => {

    try {

      const files =
        req.files?.files || [];

      const proofFiles =
        req.files?.proofFiles || [];

      const channelId =
        req.body.channelId;

      const credits =
        req.body.credits || "";

      const description =
        req.body.description || "";

      // =========================
      // VALIDATION
      // =========================

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: "Channel belum dipilih."
        });
      }

      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "File utama belum dipilih."
        });
      }

      // =========================
      // GET CHANNEL
      // =========================

      const channel =
        await client.channels.fetch(
          channelId
        );

      if (!channel) {
        return res.status(404).json({
          success: false,
          message: "Channel tidak ditemukan."
        });
      }

      if (!channel.isTextBased()) {
        return res.status(400).json({
          success: false,
          message: "Channel bukan text channel."
        });
      }

      // =========================
      // UPLOAD PROOF
      // =========================

      let proofUrls = [];

      if (proofFiles.length > 0) {

        proofUrls =
          await uploadProofs({
            channel,
            proofFiles
          });

      }

      // =========================
      // SEND MAIN FILE
      // =========================

      const results = [];

      for (const file of files) {

        try {

          const message =
            await sendUploadedFile({
              client,
              channelId,
              file,
              credits,
              description,
              proofUrls
            });

          results.push({
            file: file.originalname,
            success: true,
            messageId: message.id
          });

        } catch (error) {

          console.error(
            `Gagal mengirim ${file.originalname}:`,
            error
          );

          results.push({
            file: file.originalname,
            success: false,
            error: error.message
          });

        }

      }

      // =========================
      // RESPONSE
      // =========================

      res.json({
        success: true,
        proofUrls,
        results
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

// =========================
// HOME
// =========================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});

// =========================
// SERVER
// =========================

app.listen(PORT, () => {

  console.log(
    `🌐 Web uploader berjalan di port ${PORT}`
  );

});

// =========================
// DISCORD READY
// =========================

client.once("ready", () => {

  console.log(
    `🤖 Bot login sebagai ${client.user.tag}`
  );

});

// =========================
// LOGIN
// =========================

client.login(
  process.env.DISCORD_TOKEN
);