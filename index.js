const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require("discord.js");

const axios = require("axios");
const config = require("./config");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const MAX_FILE_SIZE =
    config.MAX_FILE_SIZE_MB * 1024 * 1024;

client.once("ready", () => {
    console.log("--------------------------------");
    console.log("MONROE AUTO FILE UPLOADER");
    console.log(`Login sebagai ${client.user.tag}`);
    console.log("Status: ONLINE");
    console.log("--------------------------------");
});

function getMaker(content) {
    const match = content.match(
        /^(?:maker\s*:\s*|ake\s*\()(.+?)(?:\))?\s*$/im
    );

    if (!match) return null;

    return match[1].trim().replace(/\)$/, "");
}

function getProof(content) {
    const urls = content.match(/https?:\/\/[^\s<>]+/gi) || [];

    return urls
        .map(url => url.replace(/[),]+$/, ""))
        .find(url =>
            /cdn\.discordapp\.com|media\.discordapp\.net/i.test(url)
        );
}

function getTargetChannel(content, guild) {
    const match = content.match(
        /#([a-z0-9_-]+)/i
    );

    if (!match) return null;

    const requestedName = match[1].toLowerCase();

    return guild.channels.cache.find(channel =>
        channel.isTextBased() &&
        !channel.isDMBased() &&
        channel.name.toLowerCase() === requestedName
    );
}

function getFileUrl(content, proof) {
    const match = content.match(
        /^\s*file\s*:?\s*(https?:\/\/\S+)/im
    );

    if (!match) return null;

    const url = match[1].replace(/[),]+$/, "");

    if (url === proof) return null;

    return url;
}

async function downloadFile(url) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxContentLength: MAX_FILE_SIZE,
        maxBodyLength: MAX_FILE_SIZE,
        maxRedirects: 0,
        validateStatus: status => status === 200
    });

    const data = Buffer.from(response.data);

    if (data.length > MAX_FILE_SIZE) {
        throw new Error("File melebihi batas ukuran.");
    }

    const urlPath = new URL(url).pathname;
    const filename = decodeURIComponent(
        urlPath.split("/").pop() || "shared-file.bin"
    );

    return {
        attachment: data,
        name: filename
    };
}

client.on("messageCreate", async message => {
    try {
        // Abaikan bot dan pesan dari luar channel uploader.
        if (message.author.bot) return;

        if (message.guildId !== config.GUILD_ID) return;

        if (message.channelId !== config.UPLOAD_CHANNEL_ID) return;

        const content = message.content || "";

        // 1. Maker
        const maker = getMaker(content);

        // 2. Proof CDN
        const proof = getProof(content);

        // 3. Channel tujuan
        const target = getTargetChannel(
            content,
            message.guild
        );

        // 4. File dari CDN atau lampiran Discord
        const fileUrl = getFileUrl(content, proof);

        const attachment = message.attachments.find(file =>
            file.size <= MAX_FILE_SIZE
        );

        if (!maker) {
            return message.react("❌");
        }

        if (!proof) {
            return message.react("❌");
        }

        if (!target) {
            return message.react("❌");
        }

        if (!attachment && !fileUrl) {
            return message.react("❌");
        }

        // Download file dari CDN atau gunakan lampiran asli.
        let file;

        if (attachment) {
            file = await downloadFile(attachment.url);
        } else {
            const parsedUrl = new URL(fileUrl);

            // Batasi link download ke CDN Discord.
            if (
                ![
                    "cdn.discordapp.com",
                    "media.discordapp.net"
                ].includes(parsedUrl.hostname)
            ) {
                return message.react("❌");
            }

            file = await downloadFile(fileUrl);
        }

        // Pastikan proof menggunakan domain CDN Discord.
        const proofUrl = new URL(proof);

        if (
            ![
                "cdn.discordapp.com",
                "media.discordapp.net"
            ].includes(proofUrl.hostname)
        ) {
            return message.react("❌");
        }

        // Buat tampilan postingan.
        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle("📦 MONROE FILE SHARE")
            .setDescription(
                [
                    `🛠️ **Maker**`,
                    maker,
                    "",
                    `📸 **Proof File**`,
                    `[Lihat Proof](${proof})`,
                    "",
                    `📥 **Download File**`,
                    `File: \`${file.name}\``,
                    "",
                    `🏷️ **Channel**`,
                    `<#${target.id}>`
                ].join("\n")
            )
            .setImage(proof)
            .setFooter({
                text: config.FOOTER
            })
            .setTimestamp();

        // Kirim ke channel tujuan.
        await target.send({
            embeds: [embed],
            files: [file]
        });

        // Berhasil.
        await message.react("✅");

        console.log(
            `[UPLOAD] ${maker} -> #${target.name}`
        );

    } catch (error) {
        console.error("UPLOAD ERROR:", error.message);

        if (message && !message.author.bot) {
            await message.react("❌").catch(() => {});
        }
    }
});

client.login(process.env.DISCORD_TOKEN);