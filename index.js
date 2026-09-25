const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const {
  PORT
} = require("./config");

const {
  detectCredit,
  cleanCredit,
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
// MULTER
// =========================

const upload = multer({
  dest: path.join(__dirname, "uploads"),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

// =========================
// DISCORD
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// =========================
// UPLOAD
// =========================

app.post(
  "/upload",
  upload.array("files", 20),
  async (req, res) => {
    try {
      const files = req.files;

      const channelId = req.body.channelId;
      let credits = req.body.credits || "";
      let description = req.body.description || "";

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: "Channel ID wajib diisi."
        });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "File belum dipilih."
        });
      }

      // =========================
      // AUTO CREDIT DETECTION
      // =========================

      const combinedText =
        `${credits}\n${description}`;

      const detectedCredit =
        detectCredit(combinedText);

      if (detectedCredit && !credits) {
        credits = detectedCredit;
      }

      description =
        cleanCredit(description);

      credits =
        cleanCredit(credits);

      // =========================
      // SEND FILES
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
              description
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

      return res.json({
        success: true,
        results
      });

    } catch (error) {
      console.error(
        "Upload Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// =========================
// WEB SERVER
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