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
// DEFAULT DESCRIPTION
// ========================================

const DEFAULT_DESCRIPTION =
  "File telah dipersiapkan dan siap digunakan untuk melengkapi kebutuhan kamu. Setiap detail dibuat dengan tujuan memberikan hasil yang lebih nyaman, menarik, dan sesuai kebutuhan. Silakan gunakan dengan bijak dan nikmati hasil akhirnya.";

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
  proofUrls
}) {
  const container =
    new ContainerBuilder()
      .setAccentColor(0xFF7A00);

  // ======================================
  // TITLE
  // ======================================

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        "# File Share"
      )
  );

  // ======================================
  // SEPARATOR
  // ======================================

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(
        SeparatorSpacingSize.Small
      )
  );

  // ======================================
  // CREDIT + DESCRIPTION
  // ======================================

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        `🎨 **Credits :** ${credits || "-"}\n\n` +
        DEFAULT_DESCRIPTION
      )
  );

  const components = [
    container
  ];

  // ======================================
  // PROOF / CDN
  // ======================================

  if (proofUrls.length > 0) {

    const proofGallery =
      new MediaGalleryBuilder();

    for (const url of proofUrls) {

      proofGallery.addItems(
        new MediaGalleryItemBuilder()
          .setURL(url)
      );

    }

    components.push(
      proofGallery
    );
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
    getProofUrls(
      proofLinks
    );

  // ======================================
  // COMPONENTS V2 MESSAGE
  // ======================================

  const components =
    buildComponents({
      credits,
      proofUrls
    });

  await channel.send({
    components,
    flags:
      MessageFlags.IsComponentsV2
  });

  // ======================================
  // SEND FILE
  // ======================================

  if (
    files &&
    files.length > 0
  ) {

    const attachments =
      files.map(file => ({
        attachment:
          file.buffer,

        name:
          file.originalname
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