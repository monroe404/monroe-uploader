const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const archiver = require("archiver");

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

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");

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
        fs.mkdirSync(dir, {
            recursive: true
        });
    }
});

const MODS_FILE =
    path.join(DATA_DIR, "mods.json");

const PROFILES_FILE =
    path.join(DATA_DIR, "profiles.json");

if (!fs.existsSync(MODS_FILE)) {
    fs.writeFileSync(
        MODS_FILE,
        "[]"
    );
}

if (!fs.existsSync(PROFILES_FILE)) {
    fs.writeFileSync(
        PROFILES_FILE,
        "{}"
    );
}


// =================================
// USERS
// =================================

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


// =================================
// EXPRESS
// =================================

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "monroe-file-share-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            maxAge:
                7 * 24 * 60 * 60 * 1000
        }
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =================================
// MULTER
// =================================

const storage =
    multer.diskStorage({

        destination:
            function(
                req,
                file,
                cb
            ) {

                if (
                    file.fieldname ===
                    "preview"
                ) {

                    cb(
                        null,
                        PREVIEW_DIR
                    );

                } else {

                    cb(
                        null,
                        UPLOAD_DIR
                    );
                }
            },

        filename:
            function(
                req,
                file,
                cb
            ) {

                const ext =
                    path.extname(
                        file.originalname
                    );

                cb(
                    null,
                    crypto
                        .randomBytes(16)
                        .toString("hex") +
                    ext
                );
            }
    });

const upload =
    multer({
        storage,

        limits: {
            fileSize:
                500 * 1024 * 1024,

            files: 101
        }
    });


// =================================
// HELPERS
// =================================

function readJSON(file) {

    try {

        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    } catch {

        return Array.isArray(
            JSON.parse("[]")
        )
            ? []
            : {};
    }
}


function saveJSON(
    file,
    data
) {

    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        )
    );
}


function makeID() {

    return (
        Date.now().toString(36) +
        crypto
            .randomBytes(5)
            .toString("hex")
    );
}


// =================================
// AUTH
// =================================

function requireLogin(
    req,
    res,
    next
) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message: "Belum login."
        });
    }

    next();
}


function requireFounder(
    req,
    res,
    next
) {

    if (
        !req.session.user ||
        req.session.user.role !==
            "founder"
    ) {

        return res.status(403).json({
            success: false,
            message:
                "Akses Founder diperlukan."
        });
    }

    next();
}


function requireUploaderAccess(
    req,
    res,
    next
) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message: "Belum login."
        });
    }

    if (
        req.session.user.role !==
            "founder" &&
        req.session.user.role !==
            "uploader"
    ) {

        return res.status(403).json({
            success: false,
            message: "Akses ditolak."
        });
    }

    next();
}


// =================================
// LOGIN
// =================================

app.post(
    "/api/login",
    function(req, res) {

        const {
            username,
            password
        } = req.body;

        const user =
            USERS.find(
                u =>
                    u.username ===
                        username &&
                    u.password ===
                        password
            );

        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "Username atau password salah."
            });
        }

        req.session.user = {
            username:
                user.username,

            role:
                user.role
        };

        res.json({
            success: true,
            user: req.session.user
        });
    }
);


// =================================
// LOGOUT
// =================================

app.post(
    "/api/logout",
    function(req, res) {

        req.session.destroy(
            function() {

                res.json({
                    success: true
                });
            }
        );
    }
);


// =================================
// CURRENT USER
// =================================

app.get(
    "/api/me",
    function(req, res) {

        res.json({
            success: true,
            user:
                req.session.user ||
                null
        });
    }
);


// =================================
// DASHBOARD ACCESS
// =================================

app.get(
    "/api/dashboard",
    requireLogin,
    function(req, res) {

        res.json({
            success: true,

            role:
                req.session.user.role,

            canPublic:
                req.session.user.role ===
                "founder",

            canSpecial:
                true
        });
    }
);


// =================================
// PROFILE
// =================================

app.get(
    "/api/profile",
    requireLogin,
    function(req, res) {

        const profiles =
            readJSON(
                PROFILES_FILE
            );

        const profile =
            profiles[
                req.session.user.username
            ] || {};

        res.json({
            success: true,
            profile
        });
    }
);


app.post(
    "/api/profile",
    requireLogin,
    function(req, res) {

        const profiles =
            readJSON(
                PROFILES_FILE
            );

        profiles[
            req.session.user.username
        ] = {

            displayName:
                req.body.displayName ||
                "",

            tiktok:
                req.body.tiktok ||
                "",

            youtube:
                req.body.youtube ||
                "",

            discord:
                req.body.discord ||
                ""
        };

        saveJSON(
            PROFILES_FILE,
            profiles
        );

        res.json({
            success: true,
            message:
                "Profile berhasil disimpan."
        });
    }
);


// =================================
// DISCORD BOT
// =================================

const discordClient =
    new Client({
        intents: [
            GatewayIntentBits.Guilds
        ]
    });


discordClient.once(
    "ready",
    function() {

        console.log(
            `Discord bot online sebagai ${discordClient.user.tag}`
        );
    }
);


async function sendDiscordShare(
    mod
) {

    if (
        !process.env.DISCORD_TOKEN ||
        !PUBLIC_URL
    ) {

        return false;
    }

    if (
        !discordClient.isReady()
    ) {

        return false;
    }

    try {

        const guild =
            await discordClient.guilds.fetch(
                config.GUILD_ID
            );

        const channel =
            await guild.channels.fetch(
                config.UPLOADER_CHANNEL_ID
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {

            return false;
        }

        const embed =
            new EmbedBuilder()
                .setColor(0xff7a00)
                .setTitle(
                    mod.type === "public"
                        ? "🟧 MONROE PUBLIC FILE"
                        : "🔒 MONROE SPECIAL FILE"
                )
                .setDescription(
                    mod.description ||
                    "Tidak ada deskripsi."
                )
                .addFields(

                    {
                        name:
                            "📦 File",
                        value:
                            mod.name,
                        inline:
                            false
                    },

                    {
                        name:
                            "👤 Uploader",
                        value:
                            mod.uploader,
                        inline:
                            true
                    },

                    {
                        name:
                            "🎨 Credits",
                        value:
                            mod.credits ||
                            "-",
                        inline:
                            true
                    },

                    {
                        name:
                            "📝 Type",
                        value:
                            mod.type ===
                            "public"
                                ? "PUBLIC"
                                : "SPECIAL",
                        inline:
                            true
                    }
                )
                .setFooter({
                    text:
                        "MONROE COMMUNITY © 2026"
                });

        if (
            mod.preview
        ) {

            embed.setImage(
                `${PUBLIC_URL}/api/preview/${mod.id}`
            );
        }

        const button =
            new ButtonBuilder()
                .setLabel(
                    "DOWNLOAD ALL"
                )
                .setEmoji("📦")
                .setStyle(
                    ButtonStyle.Link
                )
                .setURL(
                    `${PUBLIC_URL}/download/${mod.id}`
                );

        const row =
            new ActionRowBuilder()
                .addComponents(
                    button
                );

        await channel.send({
            embeds: [
                embed
            ],
            components: [
                row
            ]
        });

        return true;

    } catch (error) {

        console.error(
            "Discord error:",
            error
        );

        return false;
    }
}


// =================================
// UPLOAD
// =================================

app.post(
    "/api/upload",

    requireUploaderAccess,

    upload.fields([
        {
            name:
                "preview",

            maxCount:
                1
        },

        {
            name:
                "files",

            maxCount:
                100
        }
    ]),

    async function(
        req,
        res
    ) {

        try {

            const user =
                req.session.user;

            let type =
                req.body.type;

            /*
             * Founder:
             * boleh PUBLIC + SPECIAL
             *
             * Uploader:
             * hanya SPECIAL
             */

            if (
                user.role ===
                "uploader"
            ) {

                type =
                    "special";
            }

            if (
                type !== "public" &&
                type !== "special"
            ) {

                type =
                    user.role ===
                    "founder"
                        ? "public"
                        : "special";
            }

            if (
                type === "public" &&
                user.role !==
                    "founder"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Public File hanya dapat diakses Founder."
                });
            }

            const files =
                req.files &&
                req.files.files
                    ? req.files.files
                    : [];

            if (!files.length) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Minimal satu file harus dipilih."
                });
            }

            const id =
                makeID();

            const modName =
                req.body.modName ||
                "Untitled File";

            const credits =
                req.body.credits ||
                "-";

            const description =
                req.body.description ||
                "";

            const preview =
                req.files &&
                req.files.preview &&
                req.files.preview[0]
                    ? req.files.preview[0]
                    : null;

            const zipPath =
                path.join(
                    ZIP_DIR,
                    `${id}.zip`
                );

            await new Promise(
                function(
                    resolve,
                    reject
                ) {

                    const output =
                        fs.createWriteStream(
                            zipPath
                        );

                    const archive =
                        archiver(
                            "zip",
                            {
                                zlib: {
                                    level: 9
                                }
                            }
                        );

                    output.on(
                        "close",
                        resolve
                    );

                    archive.on(
                        "error",
                        reject
                    );

                    archive.pipe(
                        output
                    );

                    files.forEach(
                        function(file) {

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

            const profiles =
                readJSON(
                    PROFILES_FILE
                );

            const profile =
                profiles[
                    user.username
                ] || {};

            const mod = {

                id,

                type,

                name:
                    modName,

                credits,

                description,

                uploader:
                    user.username,

                displayName:
                    profile.displayName ||
                    user.username,

                tiktok:
                    profile.tiktok ||
                    "",

                youtube:
                    profile.youtube ||
                    "",

                discord:
                    profile.discord ||
                    "",

                preview:
                    !!preview,

                createdAt:
                    new Date().toISOString()
            };

            if (preview) {

                fs.renameSync(
                    preview.path,

                    path.join(
                        PREVIEW_DIR,
                        `${id}${path.extname(
                            preview.originalname
                        )}`
                    )
                );

                mod.previewExt =
                    path.extname(
                        preview.originalname
                    );
            }

            const mods =
                readJSON(
                    MODS_FILE
                );

            mods.push(
                mod
            );

            saveJSON(
                MODS_FILE,
                mods
            );

            const metaPath =
                path.join(
                    UPLOAD_DIR,
                    `${id}.json`
                );

            saveJSON(
                metaPath,
                mod
            );

            const discordPosted =
                await sendDiscordShare(
                    mod
                );

            res.json({

                success:
                    true,

                message:
                    "File berhasil dipublish.",

                id,

                type,

                shareURL:
                    `/share/${id}`,

                downloadURL:
                    `/download/${id}`,

                discordPosted
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    "Gagal memproses file."
            });
        }
    }
);


// =================================
// PREVIEW
// =================================

app.get(
    "/api/preview/:id",
    function(req, res) {

        const mods =
            readJSON(
                MODS_FILE
            );

        const mod =
            mods.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (
            !mod ||
            !mod.preview
        ) {

            return res.status(404).end();
        }

        const files =
            fs.readdirSync(
                PREVIEW_DIR
            );

        const file =
            files.find(
                name =>
                    name.startsWith(
                        req.params.id
                    )
            );

        if (!file) {

            return res.status(404).end();
        }

        res.sendFile(
            path.join(
                PREVIEW_DIR,
                file
            )
        );
    }
);


// =================================
// SHARE API
// =================================

app.get(
    "/api/share/:id",
    function(req, res) {

        const mods =
            readJSON(
                MODS_FILE,
                []
            );

        const mod =
            mods.find(
                function(item) {
                    return item.id === req.params.id;
                }
            );

        if (!mod) {
            return res.status(404).json({
                success: false,
                message: "File tidak ditemukan."
            });
        }

        res.json({
            success: true,

            mod: {
                id: mod.id,

                name: mod.name,

                credits: mod.credits,

                description:
                    mod.description,

                uploader:
                    mod.uploader,

                profile:
                    mod.profile || {
                        displayName: "",
                        tiktok: "",
                        youtube: "",
                        discord: ""
                    },

                previewURL:
                    "/api/preview/" + mod.id,

                downloadURL:
                    "/download/" + mod.id,

                systemNote:
                    "File ini dibagikan oleh uploader. Harap tetap menghargai dan mencantumkan credit pembuat apabila diperlukan."
            }
        });
    }
);


// =================================
// DOWNLOAD
// =================================

app.get(
    "/download/:id",
    function(req, res) {

        const mods =
            readJSON(
                MODS_FILE,
                []
            );

        const mod =
            mods.find(
                function(item) {
                    return item.id === req.params.id;
                }
            );

        if (!mod) {
            return res.status(404).send(
                "File tidak ditemukan."
            );
        }

        const zipPath =
            path.join(
                ZIP_DIR,
                `${mod.id}.zip`
            );

        if (!fs.existsSync(zipPath)) {
            return res.status(404).send(
                "ZIP tidak ditemukan."
            );
        }

        res.download(
            zipPath,
            `${mod.name}.zip`
        );
    }
);


// =================================
// SHARE PAGE
// =================================

app.get(
    "/share/:id",
    function(req, res) {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "share.html"
            )
        );
    }
);


// =================================
// HEALTH CHECK
// =================================

app.get(
    "/health",
    function(req, res) {

        res.json({
            status: "online"
        });
    }
);


// =================================
// START SERVER
// =================================

app.listen(
    PORT,
    function() {

        console.log(
            `Monroe File Share berjalan di port ${PORT}`
        );
    }
);


// =================================
// DISCORD BOT LOGIN
// =================================

if (
    process.env.DISCORD_TOKEN
) {

    discordClient.login(
        process.env.DISCORD_TOKEN
    );
}