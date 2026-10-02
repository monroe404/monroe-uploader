const express = require("express");
const session = require("express-session");
const multer = require("multer");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const config = require("./config");

const app = express();

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

const PORT = config.PORT || process.env.PORT || 3000;

// =========================
// DATA DIRECTORY
// =========================

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PREVIEW_DIR = path.join(DATA_DIR, "previews");
const ZIP_DIR = path.join(DATA_DIR, "zips");

[
    DATA_DIR,
    UPLOAD_DIR,
    PREVIEW_DIR,
    ZIP_DIR
].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// =========================
// USERS
// =========================

const USERS = [
    {
        username: "monroe404",
        password: "farras1239091",
        role: "founder"
    },
    {
        username: "skymods404",
        password: "sky1239091",
        role: "uploader"
    }
];

// =========================
// SYSTEM NOTE
// =========================

const SYSTEM_NOTE =
    "File ini dibagikan oleh uploader. Harap tetap menghargai dan mencantumkan credit pembuat apabila diperlukan.";

// =========================
// PUBLIC URL
// =========================

const PUBLIC_URL = (
    process.env.PUBLIC_URL ||
    ""
).replace(/\/$/, "");

// =========================
// EXPRESS
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "monroe-file-share-session-secret",

        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

app.use(express.static(path.join(__dirname, "public")));

// =========================
// MULTER
// =========================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {

        if (file.fieldname === "preview") {
            cb(null, PREVIEW_DIR);
        } else {
            cb(null, UPLOAD_DIR);
        }
    },

    filename: function (req, file, cb) {

        const ext = path.extname(file.originalname);

        const filename =
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 10) +
            ext;

        cb(null, filename);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 500 * 1024 * 1024,
        files: 101
    }
});

// =========================
// DISCORD BOT
// =========================

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

discordClient.once("ready", () => {

    console.log(
        `Discord Bot Online: ${discordClient.user.tag}`
    );

    console.log(
        `Uploader Channel: ${config.UPLOADER_CHANNEL_ID}`
    );
});

discordClient.on("error", error => {
    console.error("Discord Client Error:", error);
});

if (process.env.DISCORD_TOKEN) {

    discordClient
        .login(process.env.DISCORD_TOKEN)
        .catch(error => {
            console.error(
                "Discord login gagal:",
                error.message
            );
        });

} else {

    console.log(
        "DISCORD_TOKEN belum tersedia. Discord Bot tidak dijalankan."
    );
}

// =========================
// FILE HELPERS
// =========================

function readJSON(file, fallback = []) {

    try {

        if (!fs.existsSync(file)) {
            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );

    } catch (error) {

        console.error(
            `Gagal membaca ${file}:`,
            error
        );

        return fallback;
    }
}

function writeJSON(file, data) {

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// =========================
// DATA FILES
// =========================

const MODS_FILE =
    path.join(DATA_DIR, "mods.json");

const PROFILES_FILE =
    path.join(DATA_DIR, "profiles.json");

// =========================
// AUTH HELPERS
// =========================

function getCurrentUser(req) {

    if (!req.session.user) {
        return null;
    }

    return req.session.user;
}

function requireLogin(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message: "Belum login."
        });
    }

    next();
}

function requireFounder(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message: "Belum login."
        });
    }

    if (req.session.user.role !== "founder") {

        return res.status(403).json({
            success: false,
            message: "Akses Founder diperlukan."
        });
    }

    next();
}

function requireUploaderAccess(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message: "Belum login."
        });
    }

    const role = req.session.user.role;

    if (
        role !== "founder" &&
        role !== "uploader"
    ) {

        return res.status(403).json({
            success: false,
            message: "Tidak memiliki akses uploader."
        });
    }

    next();
}

// =========================
// PROFILE
// =========================

function getProfiles() {

    return readJSON(
        PROFILES_FILE,
        {}
    );
}

function saveProfiles(profiles) {

    writeJSON(
        PROFILES_FILE,
        profiles
    );
}

// =========================
// LOGIN
// =========================

app.post("/api/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    const user = USERS.find(
        item =>
            item.username === username &&
            item.password === password
    );

    if (!user) {

        return res.status(401).json({
            success: false,
            message: "Username atau password salah."
        });
    }

    req.session.user = {
        username: user.username,
        role: user.role
    };

    res.json({
        success: true,

        user: {
            username: user.username,
            role: user.role
        }
    });
});

// =========================
// LOGOUT
// =========================

app.post("/api/logout", (req, res) => {

    req.session.destroy(() => {

        res.json({
            success: true
        });
    });
});

// =========================
// CURRENT USER
// =========================

app.get("/api/me", (req, res) => {

    const user = getCurrentUser(req);

    res.json({
        loggedIn: !!user,
        user
    });
});

// =========================
// DASHBOARD ACCESS
// =========================

app.get(
    "/api/dashboard",
    requireLogin,
    (req, res) => {

        res.json({
            success: true,

            user: req.session.user,

            canUpload: true,

            canFounder: req.session.user.role === "founder"
        });
    }
);

// =========================
// UPLOADER ACCESS
// =========================

app.get(
    "/api/uploader",
    requireUploaderAccess,
    (req, res) => {

        res.json({
            success: true,

            channelId:
                config.UPLOADER_CHANNEL_ID,

            user: req.session.user
        });
    }
);

// =========================
// FOUNDER ACCESS
// =========================

app.get(
    "/api/founder",
    requireFounder,
    (req, res) => {

        res.json({
            success: true,

            message: "Founder access granted.",

            user: req.session.user
        });
    }
);

// =========================
// PROFILE GET
// =========================

app.get(
    "/api/profile",
    requireLogin,
    (req, res) => {

        const profiles = getProfiles();

        const username =
            req.session.user.username;

        res.json({
            success: true,

            profile:
                profiles[username] || {
                    displayName: username,
                    tiktok: "",
                    youtube: "",
                    discord: ""
                }
        });
    }
);

// =========================
// PROFILE SAVE
// =========================

app.post(
    "/api/profile",
    requireLogin,
    (req, res) => {

        const profiles = getProfiles();

        const username =
            req.session.user.username;

        profiles[username] = {

            displayName:
                req.body.displayName || username,

            tiktok:
                req.body.tiktok || "",

            youtube:
                req.body.youtube || "",

            discord:
                req.body.discord || ""
        };

        saveProfiles(profiles);

        res.json({
            success: true,
            profile: profiles[username]
        });
    }
);

// =========================
// CREATE UNIQUE ID
// =========================

function createShareId() {

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );
}

// =========================
// DISCORD SHARE
// =========================

async function sendDiscordShare(mod) {

    try {

        if (!process.env.DISCORD_TOKEN) {

            console.log(
                "Discord tidak dikirim: DISCORD_TOKEN belum tersedia."
            );

            return false;
        }

        if (!PUBLIC_URL) {

            console.log(
                "Discord tidak dikirim: PUBLIC_URL belum diset."
            );

            return false;
        }

        if (!discordClient.isReady()) {

            console.log(
                "Discord Bot belum ready. Embed tidak dikirim."
            );

            return false;
        }

        const guild =
            await discordClient.guilds.fetch(
                config.GUILD_ID
            );

        if (!guild) {

            console.log(
                "Guild Discord tidak ditemukan."
            );

            return false;
        }

        const channel =
            await guild.channels.fetch(
                config.UPLOADER_CHANNEL_ID
            );

        if (!channel) {

            console.log(
                "Channel uploader tidak ditemukan."
            );

            return false;
        }

        if (!channel.isTextBased()) {

            console.log(
                "Channel uploader bukan text channel."
            );

            return false;
        }

        const profiles =
            getProfiles();

        const profile =
            profiles[mod.uploader] || {};

        const shareURL =
            `${PUBLIC_URL}/share/${mod.id}`;

        const downloadURL =
            `${PUBLIC_URL}/download/${mod.id}`;

        const embed =
            new EmbedBuilder()

                .setColor(0xff7a00)

                .setTitle(
                    `📦 ${mod.modName}`
                )

                .setDescription(
                    mod.description ||
                    "Tidak ada deskripsi."
                )

                .addFields({

                    name: "👤 Uploader",

                    value:
                        profile.displayName ||
                        mod.uploader ||
                        "Unknown",

                    inline: true
                })

                .addFields({

                    name: "🛠️ Credits",

                    value:
                        mod.credits ||
                        "Tidak dicantumkan.",

                    inline: true
                });

        if (profile.tiktok) {

            embed.addFields({

                name: "🎵 TikTok",

                value:
                    profile.tiktok,

                inline: true
            });
        }

        if (profile.youtube) {

            embed.addFields({

                name: "▶️ YouTube",

                value:
                    profile.youtube,

                inline: true
            });
        }

        if (profile.discord) {

            embed.addFields({

                name: "💬 Discord Community",

                value:
                    profile.discord,

                inline: true
            });
        }

        embed.addFields({

            name: "📝 Catatan",

            value: SYSTEM_NOTE,

            inline: false
        });

        if (mod.preview) {

            embed.setImage(
                `${PUBLIC_URL}${mod.preview}`
            );
        }

        embed.setFooter({
            text: "Monroe File Share"
        });

        embed.setTimestamp();

        const button =
            new ButtonBuilder()

                .setLabel("DOWNLOAD ALL")

                .setEmoji("📥")

                .setStyle(ButtonStyle.Link)

                .setURL(downloadURL);

        const row =
            new ActionRowBuilder()
                .addComponents(button);

        await channel.send({

            embeds: [embed],

            components: [row]
        });

        console.log(
            `Discord share berhasil dikirim: ${mod.modName}`
        );

        return true;

    } catch (error) {

        console.error(
            "Gagal mengirim share ke Discord:",
            error
        );

        return false;
    }
}

// =========================
// UPLOAD
// =========================

app.post(
    "/api/upload",

    requireUploaderAccess,

    upload.fields([
        {
            name: "preview",
            maxCount: 1
        },
        {
            name: "files",
            maxCount: 100
        }
    ]),

    async (req, res) => {

        try {

            const modName =
                (req.body.modName || "").trim();

            const credits =
                (req.body.credits || "").trim();

            const description =
                (req.body.description || "").trim();

            if (!modName) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Nama mod wajib diisi."
                });
            }

            const uploadedFiles =
                req.files?.files || [];

            const previewFile =
                req.files?.preview?.[0];

            if (!uploadedFiles.length) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Minimal upload 1 file mod."
                });
            }

            const id =
                createShareId();

            const zipPath =
                path.join(
                    ZIP_DIR,
                    `${id}.zip`
                );

            // =========================
            // CREATE ZIP
            // =========================

            await new Promise(
                (resolve, reject) => {

                    const output =
                        fs.createWriteStream(
                            zipPath
                        );

                    const archive =
                        archiver("zip", {
                            zlib: {
                                level: 9
                            }
                        });

                    output.on(
                        "close",
                        resolve
                    );

                    output.on(
                        "error",
                        reject
                    );

                    archive.on(
                        "error",
                        reject
                    );

                    archive.pipe(output);

                    uploadedFiles.forEach(
                        file => {

                            archive.file(
                                file.path,
                                {
                                    name:
                                        file.originalname
                                }
                            );
                        }
                    );

                    archive.finalize();
                }
            );

            // =========================
            // PREVIEW
            // =========================

            let previewURL = "";

            if (previewFile) {

                previewURL =
                    `/api/preview/${id}`;

                const previewMeta = {

                    filename:
                        previewFile.filename,

                    originalname:
                        previewFile.originalname,

                    mimetype:
                        previewFile.mimetype
                };

                fs.writeFileSync(

                    path.join(
                        PREVIEW_DIR,
                        `${id}.json`
                    ),

                    JSON.stringify(
                        previewMeta,
                        null,
                        2
                    )
                );
            }

            // =========================
            // MOD DATA
            // =========================

            const mods =
                readJSON(
                    MODS_FILE,
                    []
                );

            const mod = {

                id,

                modName,

                credits,

                description,

                uploader:
                    req.session.user.username,

                preview:
                    previewURL,

                files:
                    uploadedFiles.map(
                        file => ({
                            originalName:
                                file.originalname,

                            size:
                                file.size
                        })
                    ),

                zip:
                    `/download/${id}`,

                note:
                    SYSTEM_NOTE,

                createdAt:
                    new Date().toISOString()
            };

            mods.push(mod);

            writeJSON(
                MODS_FILE,
                mods
            );

            // =========================
            // META FILE
            // =========================

            writeJSON(

                path.join(
                    UPLOAD_DIR,
                    `${id}.json`
                ),

                mod
            );

            // =========================
            // DISCORD
            // =========================

            const discordPosted =
                await sendDiscordShare(mod);

            // =========================
            // RESPONSE
            // =========================

            res.json({

                success: true,

                message:
                    "File berhasil dipublish.",

                id,

                shareURL:
                    `/share/${id}`,

                downloadURL:
                    `/download/${id}`,

                discordPosted
            });

        } catch (error) {

            console.error(
                "Upload error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Terjadi kesalahan saat upload."
            });
        }
    }
);

// =========================
// PREVIEW
// =========================

app.get(
    "/api/preview/:id",
    (req, res) => {

        const id =
            req.params.id;

        const metaPath =
 path.join(
                PREVIEW_DIR,
                `${id}.json`
            );

        if (!fs.existsSync(metaPath)) {

            return res.status(404).send(
                "Preview tidak ditemukan."
            );
        }

        try {

            const meta =
                JSON.parse(
                    fs.readFileSync(
                        metaPath,
                        "utf8"
                    )
                );

            const filePath =
                path.join(
                    PREVIEW_DIR,
                    meta.filename
                );

            if (!fs.existsSync(filePath)) {

                return res.status(404).send(
                    "File preview tidak ditemukan."
                );
            }

            res.sendFile(filePath);

        } catch (error) {

            console.error(
                error
            );

            res.status(500).send(
                "Gagal membaca preview."
            );
        }
    }
);

// =========================
// DOWNLOAD ZIP
// =========================

app.get(
    "/download/:id",
    (req, res) => {

        const id =
            req.params.id;

        const zipPath =
            path.join(
                ZIP_DIR,
                `${id}.zip`
            );

        if (!fs.existsSync(zipPath)) {

            return res.status(404).send(
                "File tidak ditemukan."
            );
        }

        const mods =
            readJSON(
                MODS_FILE,
                []
            );

        const mod =
            mods.find(
                item =>
                    item.id === id
            );

        const filename =
            mod
                ? `${mod.modName}.zip`
                : `${id}.zip`;

        res.download(
            zipPath,
            filename
        );
    }
);

// =========================
// PUBLIC SHARE API
// =========================

app.get(
    "/api/share/:id",
    (req, res) => {

        const mods =
            readJSON(
                MODS_FILE,
                []
            );

        const mod =
            mods.find(
                item =>
                    item.id === req.params.id
            );

        if (!mod) {

            return res.status(404).json({

                success: false,

                message:
                    "Share tidak ditemukan."
            });
        }

        const profiles =
            getProfiles();

        const profile =
            profiles[mod.uploader] || {};

        res.json({

            success: true,

            mod,

            profile: {

                displayName:
                    profile.displayName ||
                    mod.uploader,

                tiktok:
                    profile.tiktok || "",

                youtube:
                    profile.youtube || "",

                discord:
                    profile.discord || ""
            },

            note:
                SYSTEM_NOTE
        });
    }
);

// =========================
// PUBLIC SHARE PAGE
// =========================

app.get(
    "/share/:id",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "share.html"
            )
        );
    }
);

// =========================
// START SERVER
// =========================

app.listen(
    PORT,
    () => {

        console.log(
            `Monroe File Share running on port ${PORT}`
        );

        console.log(
            `Public URL: ${PUBLIC_URL || "BELUM DISET"}`
        );
    }
);