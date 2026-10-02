const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const config = require("./config");

const app = express();

/* =========================
   DATA
========================= */

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET || "monroe-secret-2026",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   AUTH
========================= */

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "You are not logged in."
        });
    }

    next();
}

function requireFounder(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "You are not logged in."
        });
    }

    if (req.session.user.role !== "founder") {
        return res.status(403).json({
            success: false,
            message: "Founder access only."
        });
    }

    next();
}

function requireUploaderAccess(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "You are not logged in."
        });
    }

    const user = req.session.user;

    /*
     * Founder:
     * Bisa akses semuanya.
     */
    if (user.role === "founder") {
        return next();
    }

    /*
     * Uploader:
     * Hanya area uploader.
     */
    if (
        user.role === "uploader" &&
        config.UPLOADER_CHANNEL_ID
    ) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: "You do not have uploader access."
    });
}

/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required."
        });
    }

    const user = USERS.find(
        (account) =>
            account.username === username &&
            account.password === password
    );

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Username or password is incorrect."
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

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({
            success: true
        });
    });
});

/* =========================
   CURRENT USER
========================= */

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

/* =========================
   DASHBOARD
========================= */

app.get("/api/dashboard", requireLogin, (req, res) => {
    const user = req.session.user;

    res.json({
        success: true,

        user: {
            username: user.username,
            role: user.role
        },

        access: {
            founder: user.role === "founder",

            uploaderChannel:
                config.UPLOADER_CHANNEL_ID,

            canAccessAll:
                user.role === "founder",

            canManageOwnUploads: true,

            canManageOtherUploads:
                user.role === "founder"
        }
    });
});

/* =========================
   UPLOADER AREA
========================= */

app.get(
    "/api/uploader",
    requireUploaderAccess,
    (req, res) => {
        const user = req.session.user;

        res.json({
            success: true,

            message: "Uploader area access granted.",

            user: {
                username: user.username,
                role: user.role
            },

            channelId:
                config.UPLOADER_CHANNEL_ID,

            isFounder:
                user.role === "founder"
        });
    }
);

/* =========================
   FOUNDER AREA
========================= */

app.get(
    "/api/founder",
    requireFounder,
    (req, res) => {
        res.json({
            success: true,

            message: "Welcome Founder.",

            username:
                req.session.user.username,

            role: "founder",

            access: "ALL"
        });
    }
);

/* =========================
   PROFILE FILE
========================= */

function getProfiles() {
    const profileFile = path.join(
        DATA_DIR,
        "profiles.json"
    );

    if (!fs.existsSync(profileFile)) {
        return {};
    }

    try {
        return JSON.parse(
            fs.readFileSync(profileFile, "utf8")
        );
    } catch {
        return {};
    }
}

function saveProfiles(profiles) {
    const profileFile = path.join(
        DATA_DIR,
        "profiles.json"
    );

    fs.writeFileSync(
        profileFile,
        JSON.stringify(profiles, null, 2)
    );
}

/* =========================
   GET PROFILE
========================= */

app.get(
    "/api/profile",
    requireUploaderAccess,
    (req, res) => {
        const username =
            req.session.user.username;

        const profiles = getProfiles();

        const profile =
            profiles[username] || {
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
   SAVE PROFILE
========================= */

app.post(
    "/api/profile",
    requireUploaderAccess,
    (req, res) => {
        const username =
            req.session.user.username;

        const {
            displayName,
            tiktok,
            youtube,
            discord
        } = req.body;

        const profiles = getProfiles();

        profiles[username] = {
            displayName: displayName || "",
            tiktok: tiktok || "",
            youtube: youtube || "",
            discord: discord || ""
        };

        saveProfiles(profiles);

        res.json({
            success: true,
            message: "Profile saved."
        });
    }
);

/* =========================
   SYSTEM NOTE
========================= */

app.get(
    "/api/system-note",
    requireLogin,
    (req, res) => {
        res.json({
            success: true,

            note:
                "File ini dibagikan oleh uploader. Harap tetap menghargai dan mencantumkan credit pembuat apabila diperlukan."
        });
    }
);

/* =========================
   404
========================= */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Page or API endpoint not found."
    });
});

/* =========================
   START
========================= */

app.listen(config.PORT, () => {
    console.log("=================================");
    console.log(" MONROE FILE SHARE");
    console.log("=================================");
    console.log(
        `Server running on port ${config.PORT}`
    );
    console.log(
        `Guild ID: ${config.GUILD_ID}`
    );
    console.log(
        `Uploader Channel: ${config.UPLOADER_CHANNEL_ID}`
    );
    console.log("=================================");
});