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
// VALIDATE CDN LINKS
// ========================================

function getProofUrls(proofLinks) {
  if (!proofLinks) {
    return [];
  }

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
// BUILD COMPONENTS V2
// ========================================

function buildComponents({
  credits,
  description,
  proofUrls
}) {
  const components = [];

  // MAIN CONTAINER

  const container =
    new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "# File Share"
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(
        SeparatorSpacingSize.Small
      )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Credits :** ${credits || ""}\n` +
      `**Deskripsi :** ${description || ""}`
    )
  );

  components.push(container);

  // ========================================
  // PROOF / CDN
  // ========================================

  if (proofUrls.length > 0) {
    const gallery =
      new MediaGalleryBuilder();

    for (const url of proofUrls) {
      gallery.addItems(
        new MediaGalleryItemBuilder()
          .setURL(url)
      );
    }

    components.push(gallery);
  }

  return components;
}

// ========================================
// SEND FILE
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

  const components =
    buildComponents({
      credits,
      description,
      proofUrls
    });

  const attachments =
    files.map(file => ({
      attachment: file.buffer,
      name: file.originalname
    }));

  const message =
    await channel.send({
      components,
      files: attachments,
      flags: MessageFlags.IsComponentsV2
    });

  return message;
}

module.exports = {
  getProofUrls,
  buildComponents,
  sendUploadedFile
};