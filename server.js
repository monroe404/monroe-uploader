const express = require("express");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require("discord.js");

const config = require("./config");


/* =========================================
   DIRECTORIES
========================================= */

const DATA_DIR =
    path.join(__dirname, "data");

const UPLOAD_DIR =
    path.join(__dirname, "uploads");

const PUBLIC_DIR =
    path.join(__dirname, "public");

const MODS_FILE =
    path.join(DATA_DIR, "mods.json");


/* =========================================
   CREATE DIRECTORIES
========================================= */

[
    DATA_DIR,
    UPLOAD_DIR
].forEach(dir => {

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
            recursive: true
        });
    }

});


if (!fs.existsSync(MODS_FILE)) {

    fs.writeFileSync(
        MODS_FILE,
        "[]"
    );

}


/* =========================================
   JSON
========================================= */

function readJSON(file, fallback) {

    try {

        if (!fs.existsSync(file)) {
            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    } catch (error) {

        console.error(
            "JSON ERROR:",
            error
        );

        return fallback;
    }

}


function writeJSON(file, data) {

    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        )
    );

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
   EXPRESS
========================================= */

const app =
    express();


app.use(
    express.json()
);


app.use(
    express.urlencoded({
        extended: true
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
                7 * 24 * 60 * 60 * 1000,

            httpOnly: true
        }

    })
);


/* =========================================
   STATIC
========================================= */

app.use(
    express.static(
        PUBLIC_DIR
    )
);


/* =========================================
   MULTER
========================================= */

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                callback
            ) {

                callback(
                    null,
                    UPLOAD_DIR
                );

            },

        filename:
            function (
                req,
                file,
                callback
            ) {

                const safeName =
                    `${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${path.basename(file.originalname)}`;

                callback(
                    null,
                    safeName
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {

            files: 50,

            fileSize:
                500 * 1024 * 1024

        }

    });


/* =========================================
   AUTH
========================================= */

function requireLogin(
    req,
    res,
    next
) {

    if (!req.session.user) {

        return res
            .status(401)
            .json({
                message:
                    "Silakan login terlebih dahulu."
            });

    }

    next();

}


/* =========================================
   LOGIN
========================================= */

app.post(
    "/api/login",
    (req, res) => {

        const username =
            String(
                req.body.username || ""
            ).trim();

        const password =
            String(
                req.body.password || ""
            );

        const user =
            USERS[username];


        if (
            !user ||
            user.password !== password
        ) {

            return res
                .status(401)
                .json({
                    message:
                        "Username atau password salah."
                });

        }


        req.session.user = {

            username,

            role:
                user.role

        };


        res.json({

            success: true,

            username,

            role:
                user.role

        });

    }
);


/* =========================================
   LOGOUT
========================================= */

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            () => {

                res.json({
                    success: true
                });

            }
        );

    }
);


/* =========================================
   CURRENT USER
========================================= */

app.get(
    "/api/me",
    (req, res) => {

        if (!req.session.user) {

            return res.json({
                loggedIn: false
            });

        }


        res.json({

            loggedIn: true,

            username:
                req.session.user.username,

            role:
                req.session.user.role

        });

    }
);


/* =========================================
   DISCORD CLIENT
========================================= */

const discordClient =
    new Client({

        intents: [
            GatewayIntentBits.Guilds
        ]

    });


let discordReady = false;


discordClient.once(
    "ready",
    client => {

        discordReady = true;

        console.log(
            `Discord connected as ${client.user.tag}`
        );

    }
);


discordClient.on(
    "error",
    error => {

        console.error(
            "DISCORD ERROR:",
            error
        );

    }
);


if (process.env.DISCORD_TOKEN) {

    discordClient.login(
        process.env.DISCORD_TOKEN
    ).catch(error => {

        console.error(
            "DISCORD LOGIN ERROR:",
            error
        );

    });

} else {

    console.log(
        "DISCORD_TOKEN belum tersedia."
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


    return await discordClient.guilds.fetch(
        config.GUILD_ID
    );

}


/* =========================================
   CHANNEL SEARCH
========================================= */

app.get(
    "/api/channels",
    requireLogin,
    async (req, res) => {

        try {

            if (
                req.session.user.role !==
                "founder"
            ) {

                return res
                    .status(403)
                    .json({

                        message:
                            "Hanya Founder yang dapat memilih Public Channel."

                    });

            }


            const search =
                String(
                    req.query.search || ""
                )
                .trim()
                .toLowerCase();


            if (!search) {

                return res.json({
                    channels: []
                });

            }


            const guild =
                await getGuild();


            const channels =
                await guild.channels.fetch();


            const result =
                channels
                    .filter(channel =>

                        channel &&
                        channel.isTextBased() &&
                        channel.guildId ===
                            config.GUILD_ID &&
                        channel.name
                            .toLowerCase()
                            .includes(search)

                    )
                    .map(channel => ({

                        id:
                            channel.id,

                        name:
                            channel.name

                    }))
                    .slice(0, 25);


            res.json({

                channels:
                    result

            });

        } catch (error) {

            console.error(
                "CHANNEL SEARCH ERROR:",
                error
            );


            res
                .status(500)
                .json({

                    message:
                        "Gagal mengambil channel Discord."

                });

        }

    }
);


/* =========================================
   SEND DISCORD
========================================= */

async function sendDiscordShare(
    mod,
    uploadedFiles
) {

    const guild =
        await getGuild();


    const channel =
        await guild.channels.fetch(
            mod.channelId
        );


    if (
        !channel ||
        !channel.isTextBased()
    ) {

        throw new Error(
            "Channel Discord tidak tersedia."
        );

    }


    const descriptionLines = [];


    descriptionLines.push(
        `**Credits:** ${mod.credits || "-"}`
    );


    if (mod.tiktok) {

        descriptionLines.push(
            `**TikTok:** ${mod.tiktok}`
        );

    }


    if (mod.youtube) {

        descriptionLines.push(
            `**YouTube:** ${mod.youtube}`
        );

    }


    const embed =
        new EmbedBuilder()
            .setTitle(
                "🟧 MONROE COMMUNITY"
            )
            .setDescription(
                descriptionLines.join("\n")
            )
            .setFooter({

                text:
                    "MONROE COMMUNITY © 2026"

            });


    if (
        Array.isArray(
            mod.previewUrls
        ) &&
        mod.previewUrls.length > 0
    ) {

        embed.setImage(
            mod.previewUrls[0]
        );

    }


    await channel.send({

        embeds: [
            embed
        ]

    });


    for (
        const file
        of uploadedFiles
    ) {

        await channel.send({

            files: [

                {
                    attachment:
                        file.path,

                    name:
                        file.originalname
                }

            ]

        });

    }


    return {

        discordChannelId:
            channel.id,

        shareURL:
            `/share/${mod.id}`

    };

}

/* =========================================
   UPLOAD
========================================= */

app.post(
    "/api/upload",
    requireLogin,
    upload.array("files", 50),
    async (req, res) => {

        try {

            const user =
                req.session.user;


            const type =
                req.body.type === "special"
                    ? "special"
                    : "public";


            /* PERMISSION */

            if (
                type === "public" &&
                user.role !== "founder"
            ) {

                return res
                    .status(403)
                    .json({

                        message:
                            "Uploader tidak memiliki akses Public File."

                    });

            }


            /* FILE CHECK */

            if (
                !req.files ||
                req.files.length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        message:
                            "Pilih minimal satu file."

                    });

            }


            /* CREDITS */

            const credits =
                String(
                    req.body.credits || ""
                ).trim();


            if (!credits) {

                return res
                    .status(400)
                    .json({

                        message:
                            "Credits / Maker wajib diisi."

                    });

            }


            /* CHANNEL */

            let channelId = null;


            if (
                type === "public"
            ) {

                channelId =
                    String(
                        req.body.channelId || ""
                    ).trim();


                if (!channelId) {

                    return res
                        .status(400)
                        .json({

                            message:
                                "Channel Public wajib dipilih."

                        });

                }

            } else {

                channelId =
                    config.UPLOADER_CHANNEL_ID;

            }


            /* PREVIEW URLS */

            let previewUrls =
                req.body.previewUrls;


            if (
                !Array.isArray(
                    previewUrls
                )
            ) {

                previewUrls =
                    previewUrls
                        ? [previewUrls]
                        : [];

            }


            previewUrls =
                previewUrls
                    .map(url =>
                        String(
                            url || ""
                        ).trim()
                    )
                    .filter(Boolean)
                    .slice(0, 10);


            /* SOCIAL */

            const tiktok =
                type === "special"
                    ? String(
                        req.body.tiktok || ""
                    ).trim()
                    : "";


            const youtube =
                type === "special"
                    ? String(
                        req.body.youtube || ""
                    ).trim()
                    : "";


            /* ID */

            const id =
                crypto
                    .randomBytes(8)
                    .toString("hex");


            /* NAME */

            const firstFile =
                req.files[0];


            const originalName =
                path.parse(
                    firstFile.originalname
                ).name;


            const modName =
                originalName ||
                "Monroe File";


            /* SAVE FILE INFO */

            const savedFiles =
                req.files.map(file => ({

                    originalName:
                        file.originalname,

                    fileName:
                        path.basename(
                            file.path
                        )

                }));


            /* MOD DATA */

            const mod = {

                id,

                name:
                    modName,

                type,

                credits,

                tiktok,

                youtube,

                channelId,

                previewUrls,

                files:
                    savedFiles,

                createdBy:
                    user.username,

                createdAt:
                    new Date()
                        .toISOString()

            };


            /* SAVE DATA */

            const mods =
                readJSON(
                    MODS_FILE,
                    []
                );


            mods.push(
                mod
            );


            writeJSON(
                MODS_FILE,
                mods
            );


            /* SEND DISCORD */

            let discordResult =
                null;


            try {

                discordResult =
                    await sendDiscordShare(
                        mod,
                        req.files
                    );

            } catch (discordError) {

                console.error(
                    "DISCORD SEND ERROR:",
                    discordError
                );

            }


            /*
               PENTING:
               FILE TIDAK DIHAPUS.

               TIDAK ADA ZIP.

               TIDAK ADA REDIRECT.
            */

            res.json({

                success:
                    true,

                id,

                message:
                    "File berhasil dipublish!",

                discord:
                    discordResult

            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );


            /*
               CLEANUP HANYA JIKA
               PROSES UPLOAD GAGAL
            */

            if (req.files) {

                for (
                    const file
                    of req.files
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

                    } catch (
                        cleanupError
                    ) {

                        console.error(
                            "CLEANUP ERROR:",
                            cleanupError
                        );

                    }

                }

            }


            res
                .status(500)
                .json({

                    message:
                        "Upload gagal."

                });

        }

    }
);


/* =========================================
   SHARE API
========================================= */

app.get(
    "/api/share/:id",
    async (req, res) => {

        try {

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

                return res
                    .status(404)
                    .json({

                        message:
                            "File tidak ditemukan."

                    });

            }


            res.json({

                id:
                    mod.id,

                name:
                    mod.name,

                type:
                    mod.type,

                credits:
                    mod.credits,

                tiktok:
                    mod.tiktok || "",

                youtube:
                    mod.youtube || "",

                discord:
                    "",

                previewUrls:
                    mod.previewUrls || [],

                files:
                    mod.files || [],

                createdAt:
                    mod.createdAt

            });

        } catch (error) {

            console.error(
                "SHARE API ERROR:",
                error
            );


            res
                .status(500)
                .json({

                    message:
                        "Gagal mengambil data file."

                });

        }

    }
);


/* =========================================
   DOWNLOAD INDIVIDUAL FILE
========================================= */

app.get(
    "/download/:id/:index",
    async (req, res) => {

        try {

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

                return res
                    .status(404)
                    .send(
                        "File tidak ditemukan."
                    );

            }


            const index =
                Number(
                    req.params.index
                );


            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >=
                    mod.files.length
            ) {

                return res
                    .status(404)
                    .send(
                        "File tidak ditemukan."
                    );

            }


            const file =
                mod.files[index];


            const filePath =
                path.join(
                    UPLOAD_DIR,
                    file.fileName
                );


            if (
                !fs.existsSync(
                    filePath
                )
            ) {

                return res
                    .status(404)
                    .send(
                        "File sudah tidak tersedia."
                    );

            }


            res.download(
                filePath,
                file.originalName
            );

        } catch (error) {

            console.error(
                "DOWNLOAD ERROR:",
                error
            );


            res
                .status(500)
                .send(
                    "Gagal download file."
                );

        }

    }
);


/* =========================================
   SHARE PAGE
========================================= */

app.get(
    "/share/:id",
    (req, res) => {

        const file =
            path.join(
                PUBLIC_DIR,
                "share.html"
            );


        if (
            fs.existsSync(file)
        ) {

            return res.sendFile(
                file
            );

        }


        res
            .status(404)
            .send(
                "share.html tidak ditemukan."
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

            status:
                "online",

            discord:
                discordReady

        });

    }
);


/* =========================================
   START SERVER
========================================= */

const PORT =
    process.env.PORT ||
    config.PORT ||
    3000;


app.listen(
    PORT,
    () => {

        console.log(
            `Monroe File Share running on port ${PORT}`
        );

    }
);