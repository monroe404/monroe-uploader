const express = require("express");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
    Client,
    GatewayIntentBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags
} = require("discord.js");

const config = require("./config");


/* =========================================
   PATH
========================================= */

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const MODS_FILE = path.join(DATA_DIR, "mods.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(MODS_FILE)) {
    fs.writeFileSync(
        MODS_FILE,
        "[]",
        "utf8"
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
            fs.readFileSync(file, "utf8")
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
        ),
        "utf8"
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

const app = express();

app.set(
    "trust proxy",
    1
);

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


/* =========================================
   SESSION
========================================= */

app.use(
    session({

        secret:
            process.env.SESSION_SECRET ||
            "monroe-file-share-secret",

        resave:
            false,

        saveUninitialized:
            false,

        rolling:
            true,

        cookie: {

            maxAge:
                7 * 24 * 60 * 60 * 1000,

            httpOnly:
                true,

            sameSite:
                "lax",

            secure:
                process.env.NODE_ENV ===
                "production"

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

                const ext =
                    path.extname(
                        file.originalname
                    );

                const name =
                    path.basename(
                        file.originalname,
                        ext
                    )
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );

                const random =
                    crypto
                        .randomBytes(5)
                        .toString("hex");

                callback(
                    null,
                    `${Date.now()}-${random}-${name}${ext}`
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {

            files:
                50,

            fileSize:
                500 * 1024 * 1024

        }

    });


/* =========================================
   LOGIN CHECK
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
    function (
        req,
        res
    ) {

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

            username:
                username,

            role:
                user.role

        };

        req.session.save(
            function (error) {

                if (error) {

                    console.error(
                        "SESSION ERROR:",
                        error
                    );

                    return res
                        .status(500)
                        .json({

                            message:
                                "Gagal menyimpan session."

                        });

                }

                res.json({

                    success:
                        true,

                    username:
                        username,

                    role:
                        user.role

                });

            }
        );

    }
);


/* =========================================
   LOGOUT
========================================= */

app.post(
    "/api/logout",
    function (
        req,
        res
    ) {

        req.session.destroy(
            function (error) {

                if (error) {

                    return res
                        .status(500)
                        .json({

                            message:
                                "Logout gagal."

                        });

                }

                res.clearCookie(
                    "connect.sid"
                );

                res.json({

                    success:
                        true

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
    function (
        req,
        res
    ) {

        if (!req.session.user) {

            return res.json({

                loggedIn:
                    false

            });

        }

        res.json({

            loggedIn:
                true,

            username:
                req.session.user.username,

            role:
                req.session.user.role

        });

    }
);


/* =========================================
   DISCORD
========================================= */

const discordClient =
    new Client({

        intents: [
            GatewayIntentBits.Guilds
        ]

    });


let discordReady =
    false;


discordClient.once(
    "ready",
    function (client) {

        discordReady =
            true;

        console.log(
            `Discord connected as ${client.user.tag}`
        );

    }
);


discordClient.on(
    "error",
    function (error) {

        console.error(
            "DISCORD ERROR:",
            error
        );

    }
);


if (
    process.env.DISCORD_TOKEN
) {

    discordClient
        .login(
            process.env.DISCORD_TOKEN
        )
        .catch(
            function (error) {

                console.error(
                    "DISCORD LOGIN ERROR:",
                    error
                );

            }
        );

} else {

    console.log(
        "DISCORD_TOKEN belum tersedia."
    );

}


/* =========================================
   GUILD
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
    async function (
        req,
        res
    ) {

        try {

            if (
                req.session.user.role !==
                "founder"
            ) {

                return res
                    .status(403)
                    .json({

                        message:
                            "Hanya Founder yang dapat memilih channel."

                    });

            }

            const search =
                String(
                    req.query.search || ""
                )
                    .trim()
                    .toLowerCase();

            const guild =
                await getGuild();

            const channels =
                await guild.channels.fetch();

            const result =
                channels
                    .filter(
                        function (channel) {

                            return (
                                channel &&
                                channel.isTextBased() &&
                                channel.guildId ===
                                    config.GUILD_ID &&
                                channel.name
                            );

                        }
                    )
                    .map(
                        function (channel) {

                            return {

                                id:
                                    channel.id,

                                name:
                                    channel.name

                            };

                        }
                    )
                    .filter(
                        function (channel) {

                            if (!search) {
                                return true;
                            }

                            return channel.name
                                .toLowerCase()
                                .includes(search);

                        }
                    )
                    .slice(
                        0,
                        25
                    );

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
   DISCORD FILE SHARE
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


    const container =
        new ContainerBuilder()
            .setAccentColor(
                0xff7a00
            );


    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                "## File Share"
            )
    );


    container.addSeparatorComponents(
        new SeparatorBuilder()
    );


    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                `**🎨 credits :** ${mod.credits || "-"}`
            )
    );


  
    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                "File telah dipersiapkan dan siap digunakan untuk melengkapi kebutuhan kamu. Setiap detail dibuat dengan tujuan memberikan hasil yang lebih nyaman, menarik, dan sesuai kebutuhan. Silakan gunakan dengan bijak dan nikmati hasil akhirnya."
            )
    );


    await channel.send({

        components: [
            container
        ],

        flags:
            MessageFlags.IsComponentsV2

    });


    const previews =
        Array.isArray(
            mod.previewUrls
        )
            ? mod.previewUrls
                .filter(
                    function (url) {

                        return /^https?:\/\//i.test(
                            url
                        );

                    }
                )
                .slice(
                    0,
                    10
                )
            : [];


    if (
        previews.length > 0
    ) {

        const gallery =
            new MediaGalleryBuilder();


        gallery.addItems(
            previews.map(
                function (url) {

                    return (
                        new MediaGalleryItemBuilder()
                            .setURL(url)
                    );

                }
            )
        );


        await channel.send({

            components: [
                gallery
            ],

            flags:
                MessageFlags.IsComponentsV2

        });

    }


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
    upload.array(
        "files",
        50
    ),
    async function (
        req,
        res
    ) {

        const uploadedFiles =
            req.files || [];

        try {

            const user =
                req.session.user;

            if (
                uploadedFiles.length ===
                0
            ) {

                return res
                    .status(400)
                    .json({

                        message:
                            "Pilih minimal satu file."

                    });

            }

            const uploadType =
                req.body.type ===
                "special"
                    ? "special"
                    : "public";

            if (
                uploadType ===
                "public" &&
                user.role !==
                "founder"
            ) {

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

                return res
                    .status(403)
                    .json({

                        message:
                            "Hanya Founder yang dapat upload Public File."

                    });

            }

            let channelId =
                String(
                    req.body.channelId || ""
                ).trim();

            if (
                uploadType ===
                "special"
            ) {

                channelId =
                    config.UPLOADER_CHANNEL_ID;

            }

            if (!channelId) {

                return res
                    .status(400)
                    .json({

                        message:
                            "Channel Discord belum dipilih."

                    });

            }

            const credits =
                String(
                    req.body.credits || ""
                ).trim();

            let previewUrls = [];

            if (
                Array.isArray(
                    req.body.previewUrls
                )
            ) {

                previewUrls =
                    req.body.previewUrls;

            } else if (
                typeof req.body.previewUrls ===
                "string"
            ) {

                previewUrls =
                    req.body.previewUrls
                        .split(/\r?\n/)
                        .map(
                            function (url) {
                                return url.trim();
                            }
                        )
                        .filter(Boolean);

            }

            previewUrls =
                previewUrls
                    .filter(
                        function (url) {

                            return /^https?:\/\//i.test(
                                url
                            );

                        }
                    )
                    .slice(
                        0,
                        10
                    );

            let mods =
                readJSON(
                    MODS_FILE,
                    []
                );

            if (
                !Array.isArray(
                    mods
                )
            ) {

                mods = [];

            }

            const modId =
                crypto.randomUUID();

            const mod = {

                id:
                    modId,

                type:
                    uploadType,

                uploader:
                    user.username,

                credits:
                    credits,

                channelId:
                    channelId,

                previewUrls:
                    previewUrls,

                files:
                    uploadedFiles.map(
                        function (file) {

                            return {

                                originalname:
                                    file.originalname,

                                filename:
                                    file.filename,

                                path:
                                    file.path,

                                size:
                                    file.size,

                                mimetype:
                                    file.mimetype

                            };

                        }
                    ),

                createdAt:
                    new Date().toISOString()

            };

            mods.push(
                mod
            );

            writeJSON(
                MODS_FILE,
                mods
            );

                      let discordResult =
                null;

            try {

                discordResult =
                    await sendDiscordShare(
                        mod,
                        uploadedFiles
                    );

            } catch (discordError) {

                console.error(
                    "DISCORD SHARE ERROR:",
                    discordError
                );

                return res
                    .status(500)
                    .json({

                        message:
                            "File tersimpan, tetapi gagal dikirim ke Discord."

                    });

            }

            return res.json({

                success:
                    true,

                message:
                    "File berhasil diupload.",

                id:
                    mod.id,

                shareURL:
                    `/share/${mod.id}`,

                discord:
                    discordResult

            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

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

                } catch (deleteError) {}

            }

            return res
                .status(500)
                .json({

                    message:
                        "Gagal mengupload file."

                });

        }

    }
);


/* =========================================
   SHARE DATA
========================================= */

app.get(
    "/api/share/:id",
    async function (
        req,
        res
    ) {

        try {

            const mods =
                readJSON(
                    MODS_FILE,
                    []
                );

            const mod =
                mods.find(
                    function (item) {

                        return (
                            item.id ===
                            req.params.id
                        );

                    }
                );

            if (!mod) {

                return res
                    .status(404)
                    .json({

                        message:
                            "File tidak ditemukan."

                    });

            }

            const files =
                Array.isArray(
                    mod.files
                )
                    ? mod.files.map(
                        function (file) {

                            return {

                                name:
                                    file.originalname,

                                size:
                                    file.size,

                                mimetype:
                                    file.mimetype,

                                download:
                                    `/api/download/${mod.id}/${encodeURIComponent(file.filename)}`

                            };

                        }
                    )
                    : [];

            return res.json({

                success:
                    true,

                id:
                    mod.id,

                type:
                    mod.type,

                uploader:
                    mod.uploader,

                credits:
                    mod.credits,

                previewUrls:
                    mod.previewUrls || [],

                createdAt:
                    mod.createdAt,

                files:
                    files

            });

        } catch (error) {

            console.error(
                "SHARE API ERROR:",
                error
            );

            return res
                .status(500)
                .json({

                    message:
                        "Gagal mengambil data file."

                });

        }

    }
);


/* =========================================
   DOWNLOAD
========================================= */

app.get(
    "/api/download/:id/:filename",
    async function (
        req,
        res
    ) {

        try {

            const mods =
                readJSON(
                    MODS_FILE,
                    []
                );

            const mod =
                mods.find(
                    function (item) {

                        return (
                            item.id ===
                            req.params.id
                        );

                    }
                );

            if (!mod) {

                return res
                    .status(404)
                    .json({

                        message:
                            "File tidak ditemukan."

                    });

            }

            const file =
                mod.files.find(
                    function (item) {

                        return (
                            item.filename ===
                            req.params.filename
                        );

                    }
                );

            if (!file) {

                return res
                    .status(404)
                    .json({

                        message:
                            "File tidak ditemukan."

                    });

            }

            const filePath =
                path.resolve(
                    file.path
                );

            const uploadPath =
                path.resolve(
                    UPLOAD_DIR
                );

            if (
                !filePath.startsWith(
                    uploadPath
                )
            ) {

                return res
                    .status(403)
                    .json({

                        message:
                            "Akses file ditolak."

                    });

            }

            if (
                !fs.existsSync(
                    filePath
                )
            ) {

                return res
                    .status(404)
                    .json({

                        message:
                            "File fisik tidak ditemukan."

                    });

            }

            return res.download(
                filePath,
                file.originalname
            );

        } catch (error) {

            console.error(
                "DOWNLOAD ERROR:",
                error
            );

            return res
                .status(500)
                .json({

                    message:
                        "Gagal mengambil data file."

                });

        }

    }
);


/* =========================================
   SHARE PAGE
========================================= */

app.get(
    "/share/:id",
    function (
        req,
        res
    ) {

        const shareFile =
            path.join(
                PUBLIC_DIR,
                "share.html"
            );

        if (
            !fs.existsSync(
                shareFile
            )
        ) {

            return res
                .status(404)
                .send(
                    "share.html tidak ditemukan."
                );

        }

        res.sendFile(
            shareFile
        );

    }
);


/* =========================================
   HEALTH
========================================= */

app.get(
    "/health",
    function (
        req,
        res
    ) {

        res.json({

            status:
                "ok",

            discord:
                discordReady
                    ? "online"
                    : "offline"

        });

    }
);

/* =========================================
   API 404
========================================= */

app.use(
    "/api",
    function (
        req,
        res
    ) {

        res
            .status(404)
            .json({

                message:
                    "API tidak ditemukan."

            });

    }
);


/* =========================================
   ERROR HANDLER
========================================= */

app.use(
    function (
        error,
        req,
        res,
        next
    ) {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }

        res
            .status(500)
            .json({

                message:
                    "Terjadi kesalahan pada server."

            });

    }
);


/* =========================================
   START SERVER
========================================= */

const PORT =
    config.PORT ||
    process.env.PORT ||
    3000;


app.listen(
    PORT,
    function () {

        console.log(
            `Monroe File Share running on port ${PORT}`
        );

    }
);