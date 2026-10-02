const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const archiver = require("archiver");

const config = require("./config");

const app = express();

/* =========================
   DIRECTORIES
========================= */

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PREVIEW_DIR = path.join(DATA_DIR, "previews");
const ZIP_DIR = path.join(DATA_DIR, "zips");

[
    DATA_DIR,
    UPLOAD_DIR,
    PREVIEW_DIR,
    ZIP_DIR
].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
            recursive: true
        });
    }
});


/* =========================
   USERS
========================= */

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


/* =========================
   EXPRESS
========================= */

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "monroe-secret-2026",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            maxAge:
                1000 *
                60 *
                60 *
                24
        }
    })
);


/* =========================
   STATIC WEBSITE
========================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================
   MULTER
========================= */

const storage =
    multer.diskStorage({

        destination: (
            req,
            file,
            cb
        ) => {

            if (
                file.fieldname ===
                "preview"
            ) {
                cb(
                    null,
                    PREVIEW_DIR
                );

                return;
            }

            cb(
                null,
                UPLOAD_DIR
            );
        },

        filename: (
            req,
            file,
            cb
        ) => {

            const ext =
                path.extname(
                    file.originalname
                );

            const name =
                `${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 10)}${ext}`;

            cb(
                null,
                name
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


/* =========================
   AUTH
========================= */

function requireLogin(
    req,
    res,
    next
) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message:
                "You are not logged in."
        });

    }

    next();
}


function requireFounder(
    req,
    res,
    next
) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message:
                "You are not logged in."
        });

    }


    if (
        req.session.user.role !==
        "founder"
    ) {

        return res.status(403).json({
            success: false,
            message:
                "Founder access only."
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
            message:
                "You are not logged in."
        });

    }

    next();
}


/* =========================
   LOGIN
========================= */

app.post(
    "/api/login",
    (req, res) => {

        const {
            username,
            password
        } = req.body;


        const user =
            USERS.find(
                (account) =>
                    account.username ===
                        username &&
                    account.password ===
                        password
            );


        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "Username or password is incorrect."
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

            user: {
                username:
                    user.username,

                role:
                    user.role
            }

        });

    }
);


/* =========================
   LOGOUT
========================= */

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


/* =========================
   CURRENT USER
========================= */

app.get(
    "/api/me",
    (req, res) => {

        if (
            !req.session.user
        ) {

            return res.json({
                loggedIn: false
            });

        }


        res.json({

            loggedIn: true,

            user:
                req.session.user

        });

    }
);


/* =========================
   PROFILES
========================= */

function getProfiles() {

    const file =
        path.join(
            DATA_DIR,
            "profiles.json"
        );


    if (
        !fs.existsSync(file)
    ) {

        return {};

    }


    try {

        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    } catch {

        return {};

    }
}


function saveProfiles(
    profiles
) {

    const file =
        path.join(
            DATA_DIR,
            "profiles.json"
        );


    fs.writeFileSync(
        file,
        JSON.stringify(
            profiles,
            null,
            2
        )
    );

}


/* =========================
   PROFILE GET
========================= */

app.get(
    "/api/profile",
    requireUploaderAccess,
    (req, res) => {

        const profiles =
            getProfiles();


        const username =
            req.session.user
                .username;


        const profile =
            profiles[username] ||
            {
                displayName: "",
                tiktok: "",
                youtube: "",
                discord: ""
            };


        res.json({

            success: true,

            profile

        });

    }
);


/* =========================
   PROFILE SAVE
========================= */

app.post(
    "/api/profile",
    requireUploaderAccess,
    (req, res) => {

        const username =
            req.session.user
                .username;


        const {
            displayName,
            tiktok,
            youtube,
            discord
        } = req.body;


        const profiles =
            getProfiles();


        profiles[username] = {

            displayName:
                displayName ||
                "",

            tiktok:
                tiktok ||
                "",

            youtube:
                youtube ||
                "",

            discord:
                discord ||
                ""

        };


        saveProfiles(
            profiles
        );


        res.json({

            success: true,

            message:
                "Profile saved."

        });

    }
);


/* =========================
   MOD DATABASE
========================= */

function getMods() {

    const file =
        path.join(
            DATA_DIR,
            "mods.json"
        );


    if (
        !fs.existsSync(file)
    ) {

        return [];

    }


    try {

        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    } catch {

        return [];

    }

}


function saveMods(
    mods
) {

    const file =
        path.join(
            DATA_DIR,
            "mods.json"
        );


    fs.writeFileSync(
        file,
        JSON.stringify(
            mods,
            null,
            2
        )
    );

}


/* =========================
   SYSTEM NOTE
========================= */

const SYSTEM_NOTE =
    "File ini dibagikan oleh uploader. Harap tetap menghargai dan mencantumkan credit pembuat apabila diperlukan.";


/* =========================
   CREATE ZIP
========================= */

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
                () => {

                    resolve();

                }
            );


            archive.on(
                "error",
                (error) => {

                    reject(
                        error
                    );

                }
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


/* =========================
   UPLOAD MOD
========================= */

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

    async (
        req,
        res
    ) => {

        try {

            const {
                modName,
                credits,
                description
            } = req.body;


            const uploadedFiles =
                req.files &&
                req.files.files
                    ? req.files.files
                    : [];


            const preview =
                req.files &&
                req.files.preview
                    ? req.files.preview[0]
                    : null;


            if (
                !modName
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Mod name is required."
                });

            }


            if (
                uploadedFiles.length ===
                0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Upload at least one file."
                });

            }


            const username =
                req.session.user
                    .username;


            const id =
                `${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 10)}`;


            const zipName =
                `${id}.zip`;


            const zipPath =
                path.join(
                    ZIP_DIR,
                    zipName
                );


            await createZip(
                uploadedFiles,
                zipPath
            );


            const profiles =
                getProfiles();


            const uploaderProfile =
                profiles[
                    username
                ] || {
                    displayName:
                        username,

                    tiktok: "",

                    youtube: "",

                    discord: ""
                };


            const mod = {

                id,

                modName,

                credits:
                    credits ||
                    "",

                description:
                    description ||
                    "",

                uploader:
                    username,

                uploaderProfile,

                note:
                    SYSTEM_NOTE,

                preview:
                    preview
                        ? `/api/preview/${id}`
                        : null,

                zip:
                    `/download/${id}`,

                files:
                    uploadedFiles.map(
                        (file) => ({
                            originalName:
                                file.originalname
                        })
                    ),

                createdAt:
                    new Date()
                        .toISOString()

            };


            const mods =
                getMods();


            mods.push(
                mod
            );


            saveMods(
                mods
            );


            const metaFile =
                path.join(
                    UPLOAD_DIR,
                    `${id}.json`
                );


            fs.writeFileSync(
                metaFile,
                JSON.stringify(
                    {
                        files:
                            uploadedFiles.map(
                                (file) => ({
                                    path:
                                        file.path,

                                    originalName:
                                        file.originalname
                                })
                            ),

                        preview:
                            preview
                                ? preview.path
                                : null
                    },
                    null,
                    2
                )
            );


            res.json({

                success: true,

                message:
                    "Mod published successfully.",

                shareUrl:
                    `/share/${id}`,

                downloadUrl:
                    `/download/${id}`,

                mod

            });

        } catch (
            error
        ) {

            console.error(
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Upload failed."

            });

        }

    }
);


/* =========================
   PREVIEW
========================= */

app.get(
    "/api/preview/:id",
    (req, res) => {

        const id =
            req.params.id;


        const metaFile =
            path.join(
                UPLOAD_DIR,
                `${id}.json`
            );


        if (
            !fs.existsSync(
                metaFile
            )
        ) {

            return res.status(404)
                .end();

        }


        const meta =
            JSON.parse(
                fs.readFileSync(
                    metaFile,
                    "utf8"
                )
            );


        if (
            !meta.preview ||
            !fs.existsSync(
                meta.preview
            )
        ) {

            return res.status(404)
                .end();

        }


        res.sendFile(
            meta.preview
        );

    }
);


/* =========================
   DOWNLOAD ZIP
========================= */

app.get(
    "/download/:id",
    (req, res) => {

        const mods =
            getMods();


        const mod =
            mods.find(
                (item) =>
                    item.id ===
                    req.params.id
            );


        if (!mod) {

            return res.status(404)
                .send(
                    "File not found."
                );

        }


        const zipPath =
            path.join(
                ZIP_DIR,
                `${mod.id}.zip`
            );


        if (
            !fs.existsSync(
                zipPath
            )
        ) {

            return res.status(404)
                .send(
                    "ZIP file not found."
                );

        }


        res.download(
            zipPath,
            `${mod.modName}.zip`
        );

    }
);


/* =========================
   PUBLIC SHARE DATA
========================= */

app.get(
    "/api/share/:id",
    (req, res) => {

        const mods =
            getMods();


        const mod =
            mods.find(
                (item) =>
                    item.id ===
                    req.params.id
            );


        if (!mod) {

            return res.status(404).json({
                success: false,
                message:
                    "Share not found."
            });

        }


        res.json({

            success: true,

            mod

        });

    }
);


/* =========================
   PUBLIC SHARE PAGE
========================= */

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


/* =========================
   404
========================= */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "Page or API endpoint not found."

        });

    }
);


/* =========================
   SERVER
========================= */

app.listen(
    config.PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            " MONROE FILE SHARE"
        );

        console.log(
            "================================="
        );

        console.log(
            `Server running on port ${config.PORT}`
        );

        console.log(
            `Guild ID: ${config.GUILD_ID}`
        );

        console.log(
            `Uploader Channel: ${config.UPLOADER_CHANNEL_ID}`
        );

        console.log(
            "================================="
        );

    }
);