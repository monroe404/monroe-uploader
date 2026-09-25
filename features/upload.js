const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags
} = require("discord.js");

// ========================================
// GIF
// ========================================

const GIF_URL =
  "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif";

// ========================================
// PROOF URL
// ========================================

function getProofUrls(proofLinks) {
  if (!proofLinks) return [];

  const links = Array.isArray(proofLinks)
    ? proofLinks
    : [proofLinks];

  return links
    .map(link => String(link).trim())
    .filter(link => {
      try {
        const url = new URL(link);

        return (
          url.protocol === "https:" ||
          url.protocol === "http:"
        );
      } catch {
        return false;
      }
    });
}

// ========================================
// COMPONENTS V2
// ========================================

function buildComponents({
  credits,
  description,
  proofUrls
}) {
  const container =
    new ContainerBuilder()
      .setAccentColor(0xFF7A00);

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent("# File Share")
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(
        SeparatorSpacingSize.Small
      )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        `**Credits :** ${credits || "-"}\n` +
        `**Deskripsi :** ${description || "-"}`
      )
  );

  const components = [
    container
  ];

  // ========================================
  // GIF
  // ========================================

  const gifGallery =
    new MediaGalleryBuilder();

  gifGallery.addItems(
    new MediaGalleryItemBuilder()
      .setURL(GIF_URL)
  );

  components.push(gifGallery);

  // ========================================
  // PROOF / CDN
  // ========================================

  if (proofUrls.length > 0) {
    const proofGallery =
      new MediaGalleryBuilder();

    for (const url of proofUrls) {
      proofGallery.addItems(
        new MediaGalleryItemBuilder()
          .setURL(url)
      );
    }

    components.push(proofGallery);
  }

  return components;
}

// ========================================
// SEND UPLOAD
// ========================================

async function sendUploadedFile({
  client,
  channelId,
  files,
  credits,
  description,
  proofLinks
}) {
  const channel =
    await client.channels.fetch(
      channelId
    );

  if (!channel) {
    throw new Error(
      "Channel tidak ditemukan."
    );
  }

  if (!channel.isTextBased()) {
    throw new Error(
      "Channel bukan text channel."
    );
  }

  const proofUrls =
    getProofUrls(proofLinks);

  // ========================================
  // 1. SEND COMPONENTS V2
  // ========================================

  const components =
    buildComponents({
      credits,
      description,
      proofUrls
    });

  await channel.send({
    components,
    flags: MessageFlags.IsComponentsV2
  });

  // ========================================
  // 2. SEND FILE
  // ========================================

  if (files && files.length > 0) {

    const attachments =
      files.map(file => ({
        attachment: file.buffer,
        name: file.originalname
      }));

    await channel.send({
      files: attachments
    });
  }

  return true;
}

module.exports = {
  getProofUrls,
  buildComponents,
  sendUploadedFile
};