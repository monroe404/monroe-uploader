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
const SOURCE_FILE = path.join(DATA_DIR, "sources.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(SOURCE_FILE)) {
    fs.writeFileSync(
        SOURCE_FILE,
        "[]",
        "utf8"
    );
}

fs.mkdirSync(DATA_DIR, {
    recursive: true
});

fs.mkdirSync(UPLOAD_DIR, {
    recursive: true
});


if (!fs.existsSync(MODS_FILE)) {
    fs.writeFileSync(MODS_FILE, "[]");
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

        console.error("JSON ERROR:", error);

        return fallback;
    }
}


function writeJSON(file, data) {

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
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

app.set("trust proxy", 1);

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
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

        resave: false,

        saveUninitialized: false,

        rolling: true,

        cookie: {

            maxAge:
                7 * 24 * 60 * 60 * 1000,

            httpOnly: true,

            sameSite: "lax",

            secure:
                process.env.NODE_ENV === "production"

        }

    })
);


/* =========================================
   STATIC
========================================= */

app.use(
    express.static(PUBLIC_DIR)
);


/* =========================================
   MULTER
========================================= */

const storage =
    multer.diskStorage({

        destination: function (
            req,
            file,
            callback
        ) {

            callback(
                null,
                UPLOAD_DIR
            );

        },

        filename: function (
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

            files: 50,

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

                    success: true,

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
    function (
        req,
        res
    ) {

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

app.post("/api/source", function(req, res) {

    if (!req.session.user) {
        return res.status(401).json({
            message: "Belum login."
        });
    }

    if (req.session.user.role !== "founder") {
        return res.status(403).json({
            message: "Hanya founder yang bisa menambahkan source."
        });
    }

    const link =
        String(req.body.link || "").trim();

    if (!link) {
        return res.status(400).json({
            message: "Link Discord wajib diisi."
        });
    }

    let url;

    try {
        url = new URL(link);
    } catch (error) {
        return res.status(400).json({
            message: "Link tidak valid."
        });
    }

    const validDiscord =
        (
            url.hostname === "discord.gg" ||
            url.hostname === "www.discord.gg" ||
            url.hostname === "discord.com" ||
            url.hostname === "www.discord.com"
        ) &&
        (
            url.hostname.includes("discord.gg") ||
            url.pathname.startsWith("/invite/")
        );

    if (!validDiscord) {
        return res.status(400).json({
            message:
                "Gunakan link Discord seperti https://discord.gg/..."
        });
    }

    let sources = [];

    try {
        sources = JSON.parse(
            fs.readFileSync(
                SOURCE_FILE,
                "utf8"
            )
        );
    } catch (error) {
        sources = [];
    }

    const source = {
        id: crypto.randomUUID(),
        link: link,
        createdBy: req.session.user.username,
        createdAt: new Date().toISOString()
    };

    sources.push(source);

    fs.writeFileSync(
        SOURCE_FILE,
        JSON.stringify(
            sources,
            null,
            4
        ),
        "utf8"
    );

    return res.json({
        success: true,
        message: "Source berhasil disimpan.",
        source: source
    });
});


app.get("/api/sources", function(req, res) {

    if (!req.session.user) {
        return res.status(401).json({
            message: "Belum login."
        });
    }

    let sources = [];

    try {
        sources = JSON.parse(
            fs.readFileSync(
                SOURCE_FILE,
                "utf8"
            )
        );
    } catch (error) {
        sources = [];
    }

    return res.json({
        success: true,
        sources: sources
    });
});

    return res.json({
        success: true,
        sources: sources
    });

    const link =
    String(req.body.link || "").trim();

    if (!link) {
        return res.status(400).json({
            message: "Link Discord wajib diisi."
        });
    }

    let url;

    try {
        url = new URL(link);
    } catch (error) {
        return res.status(400).json({
            message: "Link tidak valid."
        });
    }

    const validDiscord =
        (
            url.hostname === "discord.gg" ||
            url.hostname === "www.discord.gg" ||
            url.hostname === "discord.com" ||
            url.hostname === "www.discord.com"
        ) &&
        (
            url.hostname.includes("discord.gg") ||
            url.pathname.startsWith("/invite/")
        );

    if (!validDiscord) {
        return res.status(400).json({
            message:
                "Gunakan link Discord seperti https://discord.gg/..."
        });
    }

    let sources = [];

    try {
        sources = JSON.parse(
            fs.readFileSync(
                SOURCE_FILE,
                "utf8"
            )
        );
    } catch (error) {
        sources = [];
    }

    const source = {
        id: crypto.randomUUID(),
        link: link,
        createdBy: req.session.user.username,
        createdAt: new Date().toISOString()
    };

    sources.push(source);

    fs.writeFileSync(
        SOURCE_FILE,
        JSON.stringify(
            sources,
            null,
            4
        ),
        "utf8"
    );

    return res.json({
        success: true,
        message: "Source berhasil disimpan.",
        source: source
    });


/* =========================================
   DISCORD
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
    function (client) {

        discordReady = true;

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


if (process.env.DISCORD_TOKEN) {

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
        .filter(function (channel) {
            return (
                channel &&
                channel.isTextBased() &&
                channel.guildId === config.GUILD_ID &&
                channel.name
            );
        })
        .map(function (channel) {
            return {
                id: channel.id,
                name: channel.name
            };
        })
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


    // =========================
    // FILE SHARE CONTAINER
    // =========================

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


    // =========================
    // SEND CONTAINER
    // =========================

    await channel.send({
        components: [
            container
        ],
        flags:
            MessageFlags.IsComponentsV2
    });


    // =========================
    // PREVIEW
    // DI LUAR CONTAINER
    // =========================

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
                .slice(0, 10)
            : [];


    if (
        previews.length > 0
    ) {

        const gallery =
            new MediaGalleryBuilder();


        gallery.addItems(
            previews.map(
                function (url) {

                    return new MediaGalleryItemBuilder()
                        .setURL(url);

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


    // =========================
    // FILE
    // SATU PER SATU
    // DI LUAR CONTAINER
    // =========================

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


            /* =====================================
               FILE CHECK
            ===================================== */

            if (
                uploadedFiles.length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        message:
                            "Pilih minimal satu file."

                    });

            }


            /* =====================================
               PUBLIC / SPECIAL
            ===================================== */

            const uploadType =
                req.body.type === "special"
                    ? "special"
                    : "public";


            if (
                uploadType === "public" &&
                user.role !== "founder"
            ) {

                return res
                    .status(403)
                    .json({

                        message:
                            "Kamu tidak memiliki akses Public File."

                    });

            }


            /* =====================================
               CREDITS
            ===================================== */

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


            /* =====================================
               DESCRIPTION
            ===================================== */

            const description =
                String(
                    req.body.description || ""
                ).trim();


            /* =====================================
               CHANNEL
            ===================================== */

            let channelId;


            if (
                uploadType === "special"
            ) {

                channelId =
                    config.UPLOADER_CHANNEL_ID;

            } else {

                channelId =
                    String(
                        req.body.channelId ||
                        ""
                    ).trim();


                if (!channelId) {

                    return res
                        .status(400)
                        .json({

                            message:
                                "Pilih channel terlebih dahulu."

                        });

                }

            }


            /* =====================================
               PREVIEW
            ===================================== */

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
                    .map(
                        function (url) {

                            return String(
                                url || ""
                            ).trim();

                        }
                    )
                    .filter(
                        function (url) {

                            return (
                                url.length > 0
                            );

                        }
                    )
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


            /* =====================================
               SPECIAL SOCIAL
            ===================================== */

            const tiktok =
                uploadType === "special"
                    ? String(
                        req.body.tiktok || ""
                    ).trim()
                    : "";


            const youtube =
                uploadType === "special"
                    ? String(
                        req.body.youtube || ""
                    ).trim()
                    : "";


            /* =====================================
               ID
            ===================================== */

            const id =
                crypto
                    .randomBytes(8)
                    .toString("hex");


            /* =====================================
               NAME
            ===================================== */

            const firstFile =
                uploadedFiles[0];


            const fileName =
                path.parse(
                    firstFile.originalname
                ).name;


            /* =====================================
               SAVE FILE DATA
            ===================================== */

            const savedFiles =
                uploadedFiles.map(
                    function (file) {

                        return {

                            originalName:
                                file.originalname,

                            fileName:
                                path.basename(
                                    file.path
                                )

                        };

                    }
                );


            /* =====================================
               MOD
            ===================================== */

            const mod = {

                id:

                    id,

                name:

                    fileName ||
                    "Monroe File",

                description:

                    description,

                credits:

                    credits,

                tiktok:

                    tiktok,

                youtube:

                    youtube,

                channelId:

                    channelId,

                previewUrls:

                    previewUrls,

                files:

                    savedFiles,

                createdBy:

                    user.username,

                createdAt:

                    new Date()
                        .toISOString()

            };


            /* =====================================
               SAVE
            ===================================== */

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


            /* =====================================
               DISCORD
            ===================================== */

            let discord =
                null;


            try {

                discord =
                    await sendDiscordShare(
                        mod,
                        uploadedFiles
                    );

            } catch (error) {

                console.error(
                    "DISCORD SEND ERROR:",
                    error
                );

            }


            /* =====================================
               SUCCESS
            ===================================== */

            return res.json({

                success:
                    true,

                message:
                    "File berhasil dipublish!",

                id:
                    id,

                discord:
                    discord

            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );


            /*
               Hapus file hanya kalau
               proses upload benar-benar
               gagal.
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

                } catch (
                    cleanupError
                ) {

                    console.error(
                        "CLEANUP ERROR:",
                        cleanupError
                    );

                }

            }


            return res
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


            res.json({

                id:
                    mod.id,

                name:
                    mod.name,

                description:
                    mod.description ||
                    "",

                credits:
                    mod.credits ||
                    "",

                tiktok:
                    mod.tiktok ||
                    "",

                youtube:
                    mod.youtube ||
                    "",

                previewUrls:
                    mod.previewUrls ||
                    [],

                files:
                    mod.files ||
                    [],

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
   DOWNLOAD
========================================= */

app.get(
    "/download/:id/:index",
    function (
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
                index >= mod.files.length
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


            return res.download(
                filePath,
                file.originalName
            );

        } catch (error) {

            console.error(
                "DOWNLOAD ERROR:",
                error
            );


            return res
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
            fs.existsSync(
                shareFile
            )
        ) {

            return res.sendFile(
                shareFile
            );

        }


        return res
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
    function (
        req,
        res
    ) {

        res.json({

            status:
                "online",

            discord:
                discordReady

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
                    "API endpoint tidak ditemukan."

            });

    }
);


/* =========================================
   SERVER ERROR
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

            return next(error);

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
   START
========================================= */

const PORT =
    process.env.PORT ||
    config.PORT ||
    3000;


app.listen(
    PORT,
    function () {

        console.log(
            `Monroe File Share running on port ${PORT}`
        );

    }
);