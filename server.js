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

const PORT = process.env.PORT || config.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const ZIP_DIR = path.join(DATA_DIR, "zips");

const MODS_FILE = path.join(DATA_DIR, "mods.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ZIP_DIR, { recursive: true });


/* =========================================
   JSON HELPERS
========================================= */

function readJSON(file, fallback = []) {

    try {

        if (!fs.existsSync(file)) {
            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );

    } catch (error) {

        return fallback;

    }
}


function writeJSON(file, data) {

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );

}


if (!fs.existsSync(MODS_FILE)) {
    writeJSON(MODS_FILE, []);
}


/* =========================================
   USERS
========================================= */

const USERS = {

    monroe404: {
        password: "farras1239091",
        role: "founder"
    },

    skymods404: {
        password: "sky1239091",
        role: "uploader"
    }

};


/* =========================================
   MIDDLEWARE
========================================= */

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "monroe-file-share-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================================
   MULTER
========================================= */

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(null, UPLOAD_DIR);

    },

    filename: function (req, file, cb) {

        const ext =
            path.extname(file.originalname);

        const name =
            crypto.randomBytes(12).toString("hex");

        cb(
            null,
            `${name}${ext}`
        );

    }

});


const upload = multer({
    storage,

    limits: {
        fileSize: 1024 * 1024 * 500
    }
});


/* =========================================
   AUTH
========================================= */

function requireLogin(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({
            message: "Belum login."
        });

    }

    next();

}


/* =========================================
   LOGIN
========================================= */

app.post("/api/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    const user =
        USERS[username];

    if (
        !user ||
        user.password !== password
    ) {

        return res.status(401).json({
            message:
                "Username atau password salah."
        });

    }


    req.session.user = {

        username,

        role: user.role

    };


    res.json({

        success: true,

        user: {
            username,
            role: user.role
        }

    });

});


/* =========================================
   LOGOUT
========================================= */

app.post("/api/logout", (req, res) => {

    req.session.destroy(() => {

        res.json({
            success: true
        });

    });

});


/* =========================================
   CURRENT USER
========================================= */

app.get("/api/me", (req, res) => {

    if (!req.session.user) {

        return res.json({
            loggedIn: false
        });

    }


    res.json({

        loggedIn: true,

        user: req.session.user

    });

});


/* =========================================
   DISCORD CLIENT
========================================= */

const client = new Client({

    intents: [
        GatewayIntentBits.Guilds
    ]

});


let discordReady = false;


client.once("ready", () => {

    discordReady = true;

    console.log(
        `Discord bot online sebagai ${client.user.tag}`
    );

});


client.on("error", error => {

    console.error(
        "Discord error:",
        error
    );

});


if (process.env.DISCORD_TOKEN) {

    client.login(
        process.env.DISCORD_TOKEN
    ).catch(error => {

        console.error(
            "Discord login gagal:",
            error.message
        );

    });

} else {

    console.log(
        "DISCORD_TOKEN belum diset."
    );

}


/* =========================================
   GET GUILD
========================================= */

async function getGuild() {

    if (!discordReady) {

        throw new Error(
            "Discord bot belum siap."
        );

    }

    const guild =
        await client.guilds.fetch(
            config.GUILD_ID
        );

    return guild;

}


/* =========================================
   CHANNEL LIST
========================================= */

app.get(
    "/api/channels",
    requireLogin,
    async (req, res) => {

        try {

            const guild =
                await getGuild();


            const channels =
                await guild.channels.fetch();


            const search =
                String(
                    req.query.search || ""
                )
                    .trim()
                    .toLowerCase();


            const result = [];


            channels.forEach(channel => {

                if (!channel) return;


                /*
                 * Hanya text channel.
                 */

                if (
                    channel.type !== 0
                ) {
                    return;
                }


                if (
                    !channel.name
                ) {
                    return;
                }


                /*
                 * Search.
                 */

                if (
                    search &&
                    !channel.name
                        .toLowerCase()
                        .includes(search)
                ) {

                    return;

                }


                result.push({

                    id: channel.id,

                    name: channel.name

                });

            });


            result.sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );


            res.json({
                channels: result
            });


        } catch (error) {

            console.error(
                "Channel error:",
                error
            );

            res.status(500).json({

                message:
                    "Gagal mengambil channel Discord."

            });

        }

    }
);


/* =========================================
   CREATE ZIP
========================================= */

function createZip(files, zipPath) {

    return new Promise(
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


            archive.on(
                "error",
                reject
            );


            archive.pipe(output);


            for (const file of files) {

                archive.file(
                    file.path,
                    {
                        name:
                            file.originalname
                    }
                );

            }


            archive.finalize();

        }
    );

}


/* =========================================
   DISCORD PUBLISH
========================================= */

async function sendDiscordShare(mod) {

    const guild =
        await getGuild();


    let channel;


    /*
     * SPECIAL
     * selalu ke UPLOADER_CHANNEL_ID
     */

    if (
        mod.type === "special"
    ) {

        channel =
            await guild.channels.fetch(
                config.UPLOADER_CHANNEL_ID
            );

    }


    /*
     * PUBLIC
     * ke channel pilihan
     */

    else {

        channel =
            await guild.channels.fetch(
                mod.channelId
            );

    }


    if (
        !channel ||
        !channel.isTextBased()
    ) {

        throw new Error(
            "Channel Discord tidak valid."
        );

    }


    const baseURL =
        (
            process.env.PUBLIC_URL ||
            ""
        ).replace(/\/$/, "");


    const shareURL =
        `${baseURL}/share/${mod.id}`;


    const embed =
        new EmbedBuilder()

            .setTitle(
                mod.type === "special"
                    ? "🔒 MONROE SPECIAL FILE"
                    : "🟧 MONROE PUBLIC FILE"
            )

            .setDescription(
                mod.description ||
                "Tidak ada deskripsi."
            )

            .addFields(

                {
                    name: "📁 FILE",
                    value:
                        mod.name ||
                        "Unknown",
                    inline: true
                },

                {
                    name: "👤 CREDIT",
                    value:
                        mod.credits ||
                        "Unknown",
                    inline: true
                }

            )

            .setColor(
                0xff7a00
            )

            .setTimestamp();


    if (mod.tiktok) {

        embed.addFields({
            name: "TikTok",
            value: mod.tiktok,
            inline: true
        });

    }


    if (mod.youtube) {

        embed.addFields({
            name: "YouTube",
            value: mod.youtube,
            inline: true
        });

    }


    if (mod.previewUrl) {

        embed.setImage(
            mod.previewUrl
        );

    }


    const row =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()

                    .setLabel(
                        "DOWNLOAD ALL"
                    )

                    .setStyle(
                        ButtonStyle.Link
                    )

                    .setURL(
                        shareURL
                    )

                    .setEmoji("📦")

            );


    await channel.send({

        embeds: [
            embed
        ],

        components: [
            row
        ]

    });


    return shareURL;

}


/* =========================================
   UPLOAD
========================================= */

app.post(
    "/api/upload",
    requireLogin,
    upload.fields([
        {
            name: "files",
            maxCount: 50
        },
        {
            name: "preview",
            maxCount: 1
        }
    ]),
    async (req, res) => {

        const uploadedFiles =
            req.files?.files || [];


        try {

            const user =
                req.session.user;


            const type =
                req.body.type === "special"
                    ? "special"
                    : "public";


            /*
             * Uploader hanya Special.
             */

            if (
                user.role === "uploader" &&
                type !== "special"
            ) {

                return res.status(403).json({

                    message:
                        "Uploader hanya dapat membuat Special File."

                });

            }


            /*
             * Founder boleh Public/Special.
             */

            if (
                user.role !== "founder" &&
                user.role !== "uploader"
            ) {

                return res.status(403).json({

                    message:
                        "Tidak memiliki akses."

                });

            }


            if (
                uploadedFiles.length === 0
            ) {

                return res.status(400).json({

                    message:
                        "Pilih minimal satu file."

                });

            }


            const credits =
                String(
                    req.body.credits || ""
                ).trim();


            const description =
                String(
                    req.body.description || ""
                ).trim();


            const tiktok =
                String(
                    req.body.tiktok || ""
                ).trim();


            const youtube =
                String(
                    req.body.youtube || ""
                ).trim();


            const previewUrl =
                String(
                    req.body.previewUrl || ""
                ).trim();


            /*
             * PUBLIC CHANNEL
             */

            let channelId = null;

            let channelName = null;


            if (
                type === "public"
            ) {

                channelId =
                    String(
                        req.body.channelId || ""
                    ).trim();


                if (!channelId) {

                    return res.status(400).json({

                        message:
                            "Pilih channel Public terlebih dahulu."

                    });

                }


                const guild =
                    await getGuild();


                const channel =
                    await guild.channels.fetch(
                        channelId
                    );


                if (
                    !channel ||
                    !channel.isTextBased()
                ) {

                    return res.status(400).json({

                        message:
                            "Channel Public tidak valid."

                    });

                }


                channelName =
                    channel.name;

            }


            /*
             * SPECIAL
             */

            if (
                type === "special"
            ) {

                channelId =
                    config.UPLOADER_CHANNEL_ID;


                const guild =
                    await getGuild();


                const channel =
                    await guild.channels.fetch(
                        channelId
                    );


                if (
                    !channel ||
                    !channel.isTextBased()
                ) {

                    return res.status(500).json({

                        message:
                            "Special channel tidak ditemukan."

                    });

                }


                channelName =
                    channel.name;

            }


            /*
             * ID
             */

            const id =
                crypto
                    .randomBytes(8)
                    .toString("hex");


            /*
             * Nama file dari channel
             * untuk Public.
             *
             * Untuk Special gunakan
             * nama pertama file jika
             * channel tidak dipilih.
             */

            let name;


            if (
                type === "public"
            ) {

                name =
                    channelName;

            } else {

                name =
                    path.basename(
                        uploadedFiles[0]
                            .originalname,
                        path.extname(
                            uploadedFiles[0]
                                .originalname
                        )
                    );

            }


            /*
             * ZIP
             */

            const zipPath =
                path.join(
                    ZIP_DIR,
                    `${id}.zip`
                );


            await createZip(
                uploadedFiles,
                zipPath
            );


            /*
             * Remove uploaded
             * temporary files.
             */

            for (
                const file
                of uploadedFiles
            ) {

                try {

                    fs.unlinkSync(
                        file.path
                    );

                } catch (error) {}

            }


            /*
             * MOD DATA
             */

            const mods =
                readJSON(
                    MODS_FILE,
                    []
                );


            const mod = {

                id,

                type,

                name,

                channelId,

                channelName,

                credits,

                description,

                tiktok,

                youtube,

                previewUrl,

                uploader:
                    user.username,

                role:
                    user.role,

                zip:
                    `${id}.zip`,

                createdAt:
                    new Date().toISOString()

            };


            mods.push(mod);

            writeJSON(
                MODS_FILE,
                mods
            );


            /*
             * SEND DISCORD
             */

            const shareURL =
                await sendDiscordShare(
                    mod
                );


            res.json({

                success: true,

                message:
                    "File berhasil dipublish.",

                id,

                shareURL

            });


        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );


            /*
             * Cleanup jika gagal.
             */

            for (
                const file
                of uploadedFiles
            ) {

                try {

                    if (
                        fs.existsSync(
                            file.path
                        )
                    ) {

                        fs.unlinkSync(
                            file.path
                        );

                    }

                } catch (cleanupError) {}

            }


            return res.status(500).json({

                message:
                    error.message ||
                    "Upload gagal."

            });

        }

    }
);


/* =========================================
   SHARE DATA
========================================= */

app.get(
    "/api/share/:id",
    async (req, res) => {

        const mods =
            readJSON(
                MODS_FILE,
                []
            );


        const mod =
            mods.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (!mod) {

            return res.status(404).json({

                message:
                    "File tidak ditemukan."

            });

        }


        res.json({

            id: mod.id,

            type: mod.type,

            name: mod.name,

            credits: mod.credits,

            description:
                mod.description,

            uploader:
                mod.uploader,

            tiktok:
                mod.tiktok || "",

            youtube:
                mod.youtube || "",

                        discord:
                "",

            previewUrl:
                mod.previewUrl || "",

            channelName:
                mod.channelName || "",

            createdAt:
                mod.createdAt

        });

    }
);


/* =========================================
   DOWNLOAD
========================================= */

app.get(
    "/download/:id",
    async (req, res) => {

        const mods =
            readJSON(
                MODS_FILE,
                []
            );

        const mod =
            mods.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!mod) {

            return res.status(404).send(
                "File tidak ditemukan."
            );

        }

        const zipPath =
            path.join(
                ZIP_DIR,
                mod.zip
            );

        if (
            !fs.existsSync(zipPath)
        ) {

            return res.status(404).send(
                "ZIP tidak ditemukan."
            );

        }

        res.download(
            zipPath,
            `${mod.name || "monroe-file"}.zip`
        );

    }
);


/* =========================================
   SHARE PAGE
========================================= */

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


/* =========================================
   HEALTH
========================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status: "ok",

            discord:
                discordReady,

            time:
                new Date().toISOString()

        });

    }
);


/* =========================================
   START SERVER
========================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Monroe File Share berjalan di port ${PORT}`
        );

    }
);