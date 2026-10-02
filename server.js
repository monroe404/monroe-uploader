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

fs.mkdirSync(
    DATA_DIR,
    {
        recursive: true
    }
);

fs.mkdirSync(
    UPLOAD_DIR,
    {
        recursive: true
    }
);


if (!fs.existsSync(MODS_FILE)) {

    fs.writeFileSync(
        MODS_FILE,
        "[]"
    );

}


/* =========================================
   JSON FUNCTIONS
========================================= */

function readJSON(
    file,
    fallback
) {

    try {

        if (
            !fs.existsSync(file)
        ) {

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


function writeJSON(
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


/* =========================================
   USERS
========================================= */

const USERS = {

    monroe404: {

        password:
            "farras1239091",

        role:
            "founder"

    },

    skymods404: {

        password:
            "sky1239091",

        role:
            "uploader"

    }

};


/* =========================================
   EXPRESS
========================================= */

const app =
    express();


/*
   Railway / HTTPS
*/

app.set(
    "trust proxy",
    1
);


/*
   JSON
*/

app.use(
    express.json()
);


/*
   FORM
*/

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
   MULTER STORAGE
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

                const extension =
                    path.extname(
                        file.originalname
                    );


                const original =
                    path.basename(
                        file.originalname,
                        extension
                    );


                const safeName =
                    original.replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


                const random =
                    crypto
                        .randomBytes(5)
                        .toString("hex");


                const filename =
                    `${Date.now()}-${random}-${safeName}${extension}`;


                callback(
                    null,
                    filename
                );

            }

    });


const upload =
    multer({

        storage:

            storage,

        limits: {

            files:
                50,

            fileSize:
                500 * 1024 * 1024

        }

    });


/* =========================================
   AUTH MIDDLEWARE
========================================= */

function requireLogin(
    req,
    res,
    next
) {

    if (
        !req.session.user
    ) {

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
                req.body.username ||
                ""
            ).trim();


        const password =
            String(
                req.body.password ||
                ""
            );


        const user =
            USERS[username];


        if (
            !user ||
            user.password !==
                password
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


        /*
           Pastikan session
           tersimpan sebelum
           response dikirim.
        */

        req.session.save(
            function (
                error
            ) {

                if (error) {

                    console.error(
                        "SESSION SAVE ERROR:",
                        error
                    );


                    return res
                        .status(500)
                        .json({

                            message:
                                "Session gagal dibuat."

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
            function (
                error
            ) {

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

        if (
            !req.session.user
        ) {

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
   DISCORD CLIENT
========================================= */

const discordClient =
    new Client({

        intents: [

            GatewayIntentBits.Guilds

        ]

    });


let discordReady =
    false;


/* =========================================
   DISCORD READY
========================================= */

discordClient.once(
    "ready",
    function (
        client
    ) {

        discordReady =
            true;


        console.log(
            `Discord connected as ${client.user.tag}`
        );

    }
);


/* =========================================
   DISCORD ERROR
========================================= */

discordClient.on(
    "error",
    function (
        error
    ) {

        console.error(
            "DISCORD ERROR:",
            error
        );

    }
);


/* =========================================
   DISCORD LOGIN
========================================= */

if (
    process.env.DISCORD_TOKEN
) {

    discordClient
        .login(
            process.env.DISCORD_TOKEN
        )
        .catch(
            function (
                error
            ) {

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
   GET GUILD
========================================= */

async function getGuild() {

    if (
        !discordReady
    ) {

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

            /*
               Hanya Founder
               yang bisa memilih
               Public Channel.
            */

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
                    req.query.search ||
                    ""
                )
                .trim()
                .toLowerCase();


            if (!search) {

                return res.json({

                    channels:
                        []

                });

            }


            const guild =
                await getGuild();


            const channels =
                await guild.channels.fetch();


            const result =
                channels
                    .filter(
                        function (
                            channel
                        ) {

                            return (

                                channel &&

                                channel.isTextBased() &&

                                channel.guildId ===
                                    config.GUILD_ID &&

                                channel.name &&

                                channel.name
                                    .toLowerCase()
                                    .includes(
                                        search
                                    )

                            );

                        }
                    )
                    .map(
                        function (
                            channel
                        ) {

                            return {

                                id:
                                    channel.id,

                                name:
                                    channel.name

                            };

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
   DISCORD COMPONENTS V2
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


    /*
       COMPONENT V2 CONTAINER

       Accent orange =
       garis/border orange
    */

    const container =
        new ContainerBuilder()
            .setAccentColor(
                0xff7a00
            );


    /* =====================================
       TITLE
    ===================================== */

    container.addTextDisplayComponents(

        new TextDisplayBuilder()
            .setContent(
                "## FILE SHARE"
            )

    );


    /* =====================================
       SEPARATOR
    ===================================== */

    container.addSeparatorComponents(

        new SeparatorBuilder()

    );


    /* =====================================
       DESCRIPTION
    ===================================== */

    if (
        mod.description
    ) {

        container.addTextDisplayComponents(

            new TextDisplayBuilder()
                .setContent(
                    `**Description**\n${mod.description}`
                )

        );


        container.addSeparatorComponents(

            new SeparatorBuilder()

        );

    }


    /* =====================================
       CREDITS
    ===================================== */

    container.addTextDisplayComponents(

        new TextDisplayBuilder()
            .setContent(
                `**Credits**\n${mod.credits || "-"}`
            )

    );


    /* =====================================
       SPECIAL SOCIAL
    ===================================== */

    if (
        mod.tiktok
    ) {

        container.addTextDisplayComponents(

            new TextDisplayBuilder()
                .setContent(
                    `**TikTok**\n${mod.tiktok}`
                )

        );

    }


    if (
        mod.youtube
    ) {

        container.addTextDisplayComponents(

            new TextDisplayBuilder()
                .setContent(
                    `**YouTube**\n${mod.youtube}`
                )

        );

    }


    /* =====================================
       PREVIEW IMAGES
    ===================================== */

    const previewUrls =
        Array.isArray(
            mod.previewUrls
        )

            ? mod.previewUrls
                .filter(
                    function (
                        url
                    ) {

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
        previewUrls.length > 0
    ) {

        container.addSeparatorComponents(

            new SeparatorBuilder()

        );


        const gallery =
            new MediaGalleryBuilder();


        gallery.addItems(

            previewUrls.map(
                function (
                    url
                ) {

                    return new MediaGalleryItemBuilder()
                        .setURL(
                            url
                        );

                }
            )

        );


        container.addMediaGalleryComponents(
            gallery
        );

    }


    /* =====================================
       SEND TO DISCORD
    ===================================== */

    await channel.send({

        components: [

            container

        ],

        files:
            uploadedFiles.map(
                function (
                    file
                ) {

                    return {

                        attachment:
                            file.path,

                        name:
                            file.originalname

                    };

                }
            ),

        flags:
            MessageFlags.IsComponentsV2

    });


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

        let uploadFiles =
            req.files || [];


        try {

            const user =
                req.session.user;


            /* =====================================
               TYPE
            ===================================== */

            const type =
                req.body.type ===
                "special"

                    ? "special"

                    : "public";


            /* =====================================
               PERMISSION
            ===================================== */

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


            /* =====================================
               FILE CHECK
            ===================================== */

            if (
                !uploadFiles.length
            ) {

                return res
                    .status(400)
                    .json({

                        message:
                            "Pilih minimal satu file."

                    });

            }


            /* =====================================
               CREDITS
            ===================================== */

            const credits =
                String(
                    req.body.credits ||
                    ""
                ).trim();


            if (
                !credits
            ) {

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
                    req.body.description ||
                    ""
                ).trim();


            /* =====================================
               CHANNEL
            ===================================== */

            let channelId =
                null;


            if (
                type === "public"
            ) {

                channelId =
                    String(
                        req.body.channelId ||
                        ""
                    ).trim();


                if (
                    !channelId
                ) {

                    return res
                        .status(400)
                        .json({

                            message:
                                "Channel Public wajib dipilih."

                        });

                }

            } else {

                /*
                   Special otomatis
                   masuk channel uploader.
                */

                channelId =
                    config.UPLOADER_CHANNEL_ID;

            }


            /* =====================================
               PREVIEW URLS
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
                        ? [
                            previewUrls
                        ]
                        : [];

            }


            previewUrls =
                previewUrls
                    .map(
                        function (
                            url
                        ) {

                            return String(
                                url || ""
                            ).trim();

                        }
                    )
                    .filter(
                        function (
                            url
                        ) {

                            return (
                                url.length > 0
                            );

                        }
                    )
                    .filter(
                        function (
                            url
                        ) {

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
               SOCIAL
            ===================================== */

            const tiktok =
                type === "special"

                    ? String(
                        req.body.tiktok ||
                        ""
                    ).trim()

                    : "";


            const youtube =
                type === "special"

                    ? String(
                        req.body.youtube ||
                        ""
                    ).trim()

                    : "";


            /* =====================================
               ID
            ===================================== */

            const id =
                crypto
                    .randomBytes(
                        8
                    )
                    .toString(
                        "hex"
                    );


            /* =====================================
               FILE NAME
            ===================================== */

            const firstFile =
                uploadFiles[0];


            const originalName =
                path.parse(
                    firstFile.originalname
                ).name;


            const modName =
                originalName ||
                "Monroe File";


            /* =====================================
               SAVE FILE INFORMATION
            ===================================== */

            const savedFiles =
                uploadFiles.map(
                    function (
                        file
                    ) {

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
               MOD DATA
            ===================================== */

            const mod = {

                id:

                    id,

                name:

                    modName,

                type:

                    type,

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
               SAVE DATA
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
               SEND DISCORD
            ===================================== */

            let discordResult =
                null;


            try {

                discordResult =
                    await sendDiscordShare(
                        mod,
                        uploadFiles
                    );


            } catch (
                discordError
            ) {

                console.error(
                    "DISCORD SEND ERROR:",
                    discordError
                );

                /*
                   Data upload tetap disimpan.
                   User tidak dilempar logout.
                */

            }


            /* =====================================
               SUCCESS
            ===================================== */

            return res.json({

                success:
                    true,

                id:
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
               Hapus file kalau proses
               benar-benar gagal.
            */

            for (
                const file
                of uploadFiles
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
                    function (
                        item
                    ) {

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

                type:
                    mod.type,

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

                discord:
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
   DOWNLOAD INDIVIDUAL FILE
========================================= */

app.get(
    "/download/:id/:index",
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
                    function (
                        item
                    ) {

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
                !Number.isInteger(
                    index
                ) ||
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
   404 API
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