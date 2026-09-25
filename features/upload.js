const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags
} = require("discord.js");

function buildUploadComponents({
  credits,
  description,
  proofUrls = []
}) {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "# File Share"
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
  );

  let text =
    `**Credits :** ${credits || ""}\n` +
    `**Deskripsi :** ${description || ""}`;

  if (proofUrls.length > 0) {
    text +=
      "\n\n**Proof :**\n" +
      proofUrls.map(url => url).join("\n");
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text)
  );

  return [container];
}

async function uploadProofs({
  channel,
  proofFiles
}) {
  if (!proofFiles || proofFiles.length === 0) {
    return [];
  }

  const urls = [];

  for (const file of proofFiles) {
    const message = await channel.send({
      files: [
        {
          attachment: file.path,
          name: file.originalname
        }
      ]
    });

    for (const attachment of message.attachments.values()) {
      urls.push(attachment.url);
    }
  }

  return urls;
}

async function sendUploadedFile({
  client,
  channelId,
  file,
  credits,
  description,
  proofUrls = []
}) {
  const channel =
    await client.channels.fetch(channelId);

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

  const components =
    buildUploadComponents({
      credits,
      description,
      proofUrls
    });

  const message =
    await channel.send({
      components,
      files: [
        {
          attachment: file.path,
          name: file.originalname
        }
      ],
      flags: MessageFlags.IsComponentsV2
    });

  return message;
}

module.exports = {
  buildUploadComponents,
  uploadProofs,
  sendUploadedFile
};