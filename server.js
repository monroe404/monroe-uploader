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
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    FileBuilder,
    MessageFlags
} = require("discord.js");

const config = require("./config");

const app = express();

const PORT =
    process.env.PORT ||
    config.PORT ||
    3000;


/* =========================================
   DIRECTORIES
========================================= */

const DATA_DIR =
    path.join(__dirname, "data");

const UPLOAD_DIR =
    path.join(DATA_DIR, "uploads");

const ZIP_DIR =
    path.join(DATA_DIR, "zips");

const MODS_FILE =
    path.join(DATA_DIR, "mods.json");


fs.mkdirSync(
    DATA_DIR,
    { recursive: true }
);

fs.mkdirSync(
    UPLOAD_DIR,
    { recursive: true }
);

fs.mkdirSync(
    ZIP_DIR,
    { recursive: true }
);


/* =========================================
   JSON
========================================= */

function readJSON(
    file,
    fallback = []
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


if (
    !fs.existsSync(
        MODS_FILE
    )
) {

    writeJSON(
        MODS_FILE,
        []
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

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7

        }

    })
);


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
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
                cb
            ) {

                cb(
                    null,
                    UPLOAD_DIR
                );

            },

        filename:
            function (
                req,
                file,
                cb
            ) {

                const ext =
                    path.extname(
                        file.originalname
                    );

                const randomName =
                    crypto
                        .randomBytes(16)
                        .toString("hex");

                cb(
                    null,
                    `${randomName}${ext}`
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {

            fileSize:
                1024 *
                1024 *
                500

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

    if (
        !req.session.user
    ) {

        return res
            .status(401)
            .json({

                message:
                    "Belum login."

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

        const {
            username,
            password
        } = req.body;


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


        res.json({

            success:
                true,

            user: {

                username:
                    username,

                role:
                    user.role

            }

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
    (req, res) => {

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

            user:
                req.session.user

        });

    }
);


/* =========================================
   DISCORD BOT
========================================= */

const client =
    new Client({

        intents: [

            GatewayIntentBits.Guilds

        ]

    });


let discordReady =
    false;


client.once(
    "ready",
    () => {

        discordReady =
            true;

        console.log(
            `Discord bot online sebagai ${client.user.tag}`
        );

    }
);


client.on(
    "error",
    error => {

        console.error(
            "Discord error:",
            error
        );

    }
);


if (
    process.env.DISCORD_TOKEN
) {

    client.login(
        process.env.DISCORD_TOKEN
    ).catch(
        error => {

            console.error(
                "Discord login gagal:",
                error.message
            );

        }
    );

} else {

    console.log(
        "DISCORD_TOKEN belum diset."
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


    const guild =
        await client.guilds.fetch(
            config.GUILD_ID
        );


    return guild;

}


/* =========================================
   CHANNEL SEARCH
========================================= */

app.get(
    "/api/channels",
    requireLogin,
    async (
        req,
        res
    ) => {

        try {

            const guild =
                await getGuild();


            const channels =
                await guild.channels.fetch();


            const search =
                String(
                    req.query.search ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const result = [];


            channels.forEach(
                channel => {

                    if (!channel) {
                        return;
                    }


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


                    if (
                        search &&
                        !channel.name
                            .toLowerCase()
                            .includes(
                                search
                            )
                    ) {

                        return;

                    }


                    result.push({

                        id:
                            channel.id,

                        name:
                            channel.name

                    });

                }
            );


            result.sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
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
   CREATE ZIP
========================================= */

function createZip(
    files,
    zipPath
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

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


            output.on(
                "error",
                reject
            );


            archive.on(
                "error",
                reject
            );


            archive.pipe(
                output
            );


            for (
                const file
                of files
            ) {

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
   DISCORD SHARE
========================================= */

async function sendDiscordShare(
    mod,
    uploadedFiles
) {

    const guild =
        await getGuild();


    let channel;


    if (
        mod.type ===
        "special"
    ) {

        channel =
            await guild.channels.fetch(
                config.UPLOADER_CHANNEL_ID
            );

    } else {

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


    const zipPath =
        path.join(
            ZIP_DIR,
            mod.zip
        );


    if (
        !fs.existsSync(
            zipPath
        )
    ) {

        throw new Error(
            "ZIP tidak ditemukan."
        );

    }


    const discordFiles = [];


    discordFiles.push({

        attachment:
            zipPath,

        name:
            mod.zip

    });


    const safeNames = [];


    for (
        let i = 0;
        i < uploadedFiles.length;
        i++
    ) {

        const file =
            uploadedFiles[i];


        const originalName =
            path.basename(
                file.originalname
            );


        const safeName =
            `${i + 1}_${originalName}`
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );


        safeNames.push(
            safeName
        );


        discordFiles.push({

            attachment:
                file.path,

            name:
                safeName

        });

    }


    const container =
        new ContainerBuilder()
            .setAccentColor(
                0xff7a00
            );


    container.addTextDisplayComponents(

        new TextDisplayBuilder()
            .setContent(
                "# File Share"
            )

    );


    container.addSeparatorComponents(

        new SeparatorBuilder()

    );


    container.addTextDisplayComponents(

        new TextDisplayBuilder()
            .setContent(
                `🎨 **Credits : ${mod.credits || "-"}**`
            )

    );


    if (
        mod.tiktok ||
        mod.youtube
    ) {

        let socialText =
            "";


        if (
            mod.tiktok
        ) {

            socialText +=
                `🎵 **TikTok :** ${mod.tiktok}\n`;

        }


        if (
            mod.youtube
        ) {

            socialText +=
                `▶️ **YouTube :** ${mod.youtube}`;

        }


        container.addTextDisplayComponents(

            new TextDisplayBuilder()
                .setContent(
                    socialText.trim()
                )

        );

    }


    if (
        Array.isArray(
            mod.previewUrls
        ) &&
        mod.previewUrls.length > 0
    ) {

        const gallery =
            new MediaGalleryBuilder();


        for (
            const previewUrl
            of mod.previewUrls.slice(
                0,
                10
            )
        ) {

            if (!previewUrl) {
                continue;
            }


            gallery.addItems(

                new MediaGalleryItemBuilder()
                    .setURL(
                        previewUrl
                    )

            );

        }


        container.addMediaGalleryComponents(
            gallery
        );

    }


    container.addSeparatorComponents(

        new SeparatorBuilder()

    );


    container.addTextDisplayComponents(

        new TextDisplayBuilder()
            .setContent(
                "File ini dibagikan oleh uploader. Harap tetap menghargai dan mencantumkan credit pembuat apabila diperlukan."
            )

    );


    for (
        const safeName
        of safeNames
    ) {

        container.addFileComponents(

            new FileBuilder()
                .setURL(
                    `attachment://${safeName}`
                )

        );

    }


    const sentMessage =
        await channel.send({

            components: [
                container
            ],

            files:
                discordFiles,

            flags:
                MessageFlags.IsComponentsV2

        });


    const zipAttachment =
        sentMessage.attachments.find(
            attachment =>
                attachment.name ===
                mod.zip
        );


    if (
        !zipAttachment
    ) {

        throw new Error(
            "ZIP gagal ditemukan pada pesan Discord."
        );

    }


    return {

        shareURL:
            `${(
                process.env.PUBLIC_URL ||
                ""
            ).replace(
                /\/$/,
                ""
            )}/share/${mod.id}`,

        discordChannelId:
            channel.id,

        discordMessageId:
            sentMessage.id,

        discordZipName:
            zipAttachment.name

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
    async (
        req,
        res
    ) => {

        const uploadedFiles =
            req.files || [];


        try {

            const user =
                req.session.user;


            const type =
                req.body.type ===
                "special"
                    ? "special"
                    : "public";


            /* =====================================
               PERMISSION
            ===================================== */

            if (
                user.role ===
                "uploader" &&
                type !==
                "special"
            ) {

                return res
                    .status(403)
                    .json({

                        message:
                            "Uploader hanya dapat membuat Special File."

                    });

            }


            if (
                user.role !==
                    "founder" &&
                user.role !==
                    "uploader"
            ) {

                return res
                    .status(403)
                    .json({

                        message:
                            "Tidak memiliki akses."

                    });

            }


            /* =====================================
               FILE CHECK
            ===================================== */

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


            /* =====================================
               FORM DATA
            ===================================== */

            const credits =
                String(
                    req.body.credits ||
                    ""
                ).trim();


            const tiktok =
                String(
                    req.body.tiktok ||
                    ""
                ).trim();


            const youtube =
                String(
                    req.body.youtube ||
                    ""
                ).trim();


            /* =====================================
               PREVIEW URLS
            ===================================== */

            let previewUrls = [];


            if (
                Array.isArray(
                    req.body.previewUrls
                )
            ) {

                previewUrls =
                    req.body.previewUrls
                        .map(
                            url =>
                                String(
                                    url ||
                                    ""
                                ).trim()
                        )
                        .filter(
                            Boolean
                        )
                        .slice(
                            0,
                            10
                        );

            } else if (
                req.body.previewUrls
            ) {

                previewUrls = [
                    String(
                        req.body.previewUrls
                    ).trim()
                ].filter(
                    Boolean
                );

            }


            /* =====================================
               CHANNEL
            ===================================== */

            let channelId =
                null;

            let channelName =
                null;


            /* =====================================
               PUBLIC
            ===================================== */

            if (
                type ===
                "public"
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
                                "Pilih channel terlebih dahulu."

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

                    return res
                        .status(400)
                        .json({

                            message:
                                "Channel Public tidak valid."

                        });

                }


                channelName =
                    channel.name;

            }


            /* =====================================
               SPECIAL
            ===================================== */

            if (
                type ===
                "special"
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

                    return res
                        .status(500)
                        .json({

                            message:
                                "Special channel tidak ditemukan."

                        });

                }


                channelName =
                    channel.name;

            }


            /* =====================================
               ID
            ===================================== */

            const id =
                crypto
                    .randomBytes(
                        10
                    )
                    .toString(
                        "hex"
                    );


            /* =====================================
               FILE NAME
            ===================================== */

            const name =
                path.basename(
                    uploadedFiles[0]
                        .originalname,
                    path.extname(
                        uploadedFiles[0]
                            .originalname
                    )
                );


            /* =====================================
               ZIP
            ===================================== */

            const zipFileName =
                `${id}.zip`;


            const zipPath =
                path.join(
                    ZIP_DIR,
                    zipFileName
                );


            await createZip(
                uploadedFiles,
                zipPath
            );


            /* =====================================
               DATA
            ===================================== */

            const mod = {

                id,

                type,

                name,

                credits,

                previewUrls,

                tiktok,

                youtube,

                uploader:
                    user.username,

                uploaderRole:
                    user.role,

                channelId,

                channelName,

                zip:
                    zipFileName,

                createdAt:
                    new Date()
                        .toISOString(),

                discordChannelId:
                    null,

                discordMessageId:
                    null,

                discordZipName:
                    null

            };


            /* =====================================
               SEND DISCORD
            ===================================== */

            const discordResult =
                await sendDiscordShare(
                    mod,
                    uploadedFiles
                );


            /* =====================================
               DISCORD DATA
            ===================================== */

            mod.discordChannelId =
                discordResult
                    .discordChannelId;


            mod.discordMessageId =
                discordResult
                    .discordMessageId;


            mod.discordZipName =
                discordResult
                    .discordZipName;


            /* =====================================
               SAVE DATABASE
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
               CLEAN TEMP FILES
            ===================================== */

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
                ) {}

            }


            try {

                if (
                    fs.existsSync(
                        zipPath
                    )
                ) {

                    fs.unlinkSync(
                        zipPath
                    );

                }

            } catch (
                cleanupError
            ) {}


            /* =====================================
               RESPONSE
            ===================================== */

            res.json({

                success:
                    true,

                message:
                    "File berhasil dipublish.",

                id,

                shareURL:
                    discordResult.shareURL

            });


        } catch (
            error
        ) {

            console.error(
                "UPLOAD ERROR:",
                error
            );


            /* =====================================
               CLEANUP ON ERROR
            ===================================== */

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
                ) {}

            }


            return res
                .status(500)
                .json({

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
    async (
        req,
        res
    ) => {

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

            type:
                mod.type,

            name:
                mod.name,

            credits:
                mod.credits ||
                "",

            uploader:
                mod.uploader ||
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
                Array.isArray(
                    mod.previewUrls
                )
                    ? mod.previewUrls
                    : mod.previewUrl
                        ? [
                            mod.previewUrl
                        ]
                        : [],

            channelName:
                mod.channelName ||
                "",

            createdAt:
                mod.createdAt

        });

    }
);


/* =========================================
   DOWNLOAD ALL
========================================= */

app.get(
    "/download/:id",
    async (
        req,
        res
    ) => {

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
                        "File tidak tersedia."
                    );

            }


            if (
                !mod.discordChannelId ||
                !mod.discordMessageId
            ) {

                return res
                    .status(404)
                    .send(
                        "File Discord tidak tersedia."
                    );

            }


            /* =====================================
               GUILD
            ===================================== */

            const guild =
                await getGuild();


            /* =====================================
               CHANNEL
            ===================================== */

            const channel =
                await guild.channels.fetch(
                    mod.discordChannelId
                );


            if (
                !channel ||
                !channel.isTextBased()
            ) {

                return res
                    .status(404)
                    .send(
                        "Channel file tidak tersedia."
                    );

            }


            /* =====================================
               MESSAGE
            ===================================== */

            const message =
                await channel.messages.fetch(
                    mod.discordMessageId
                );


            if (!message) {

                return res
                    .status(404)
                    .send(
                        "Pesan file tidak ditemukan."
                    );

            }


            /* =====================================
               ZIP
            ===================================== */

            const attachment =
                message.attachments.find(
                    file =>
                        file.name ===
                        mod.discordZipName
                );


            if (!attachment) {

                return res
                    .status(404)
                    .send(
                        "File ZIP tidak tersedia di Discord."
                    );

            }


            /* =====================================
               REDIRECT
            ===================================== */

            return res.redirect(
                attachment.url
            );


        } catch (
            error
        ) {

            console.error(
                "DOWNLOAD ERROR:",
                error
            );


            return res
                .status(500)
                .send(
                    "Gagal mengambil file dari Discord."
                );

        }

    }
);

/* =========================================
   SHARE PAGE
========================================= */

app.get(
    "/share/:id",
    (
        req,
        res
    ) => {

        res.sendFile(
            path.join(
                PUBLIC_DIR,
                "share.html"
            )
        );

    }
);


/* =========================================
   HEALTH CHECK
========================================= */

app.get(
    "/health",
    (
        req,
        res
    ) => {

        res.json({

            status:
                "ok",

            service:
                "Monroe File Share",

            time:
                new Date()
                    .toISOString()

        });

    }
);


/* =========================================
   START SERVER
========================================= */

app.listen(
    config.PORT,
    () => {

        console.log(
            `Monroe File Share running on port ${config.PORT}`
        );

    }
);