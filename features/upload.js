const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags
} = require("discord.js");

function detectCredit(text) {
  if (!text) return "";

  const regex =
    /(?:c|credit|credits)\s*[:=\-]\s*([^\n,]+)/i;

  const match = text.match(regex);

  if (!match) return "";

  return match[1].trim();
}

function cleanCredit(text) {
  if (!text) return "";

  return text
    .replace(
      /(?:c|credit|credits)\s*[:=\-]\s*[^\n,]+/gi,
      ""
    )
    .trim();
}

function buildUploadComponents({
  credits,
  description
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

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Credits :** ${credits || ""}\n` +
      `**Deskripsi :** ${description || ""}`
    )
  );

  return [
    container
  ];
}

async function sendUploadedFile({
  client,
  channelId,
  file,
  credits,
  description
}) {
  const channel = await client.channels.fetch(channelId);

  if (!channel) {
    throw new Error("Channel tidak ditemukan.");
  }

  if (!channel.isTextBased()) {
    throw new Error("Channel bukan text channel.");
  }

  const components = buildUploadComponents({
    credits,
    description
  });

  const message = await channel.send({
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
  detectCredit,
  cleanCredit,
  buildUploadComponents,
  sendUploadedFile
};