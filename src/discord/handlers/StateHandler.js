const { MessageEmbed } = require('discord.js')

class StateHandler {
  constructor(discord) {
    this.discord = discord
  }

  async onReady() {
    this.discord.app.log.discord('Client ready, logged in as ' + this.discord.client.user.tag)
    this.discord.client.user.setActivity('Guild Chat', { type: 'WATCHING' })

    if (this.discord.app.config.discord.messageMode == 'webhook') {
      this.discord.webhook = await getWebhook(this.discord)
    }

    this.discord.client.channels.fetch(this.discord.app.config.discord.channel).then(channel => {
      const exampleEmbed = new MessageEmbed()
      exampleEmbed.setColor('47F049')
      exampleEmbed.setTitle('Chat Bridge is Online')
      channel.send({embeds: [exampleEmbed]})
    })
  }

  onClose() {
    this.discord.client.channels.fetch(this.discord.app.config.discord.channel).then(channel => {
      const exampleEmbed = new MessageEmbed()
      exampleEmbed.setColor('F04947')
      exampleEmbed.setTitle('Chat Bridge is Offline')
      channel.send({embeds: [exampleEmbed]}).then(() => { process.exit() })
    }).catch(() => { process.exit() })
  }
}

async function getWebhook(discord) {
  let channel = discord.client.channels.cache.get(discord.app.config.discord.channel)
  let webhooks = await channel.fetchWebhooks()
  if (webhooks.first()) {
    return webhooks.first()
  } else {
    var res = await channel.createWebhook(discord.client.user.username, {
      avatar: discord.client.user.avatarURL(),
    })
    return res
  }
}

module.exports = StateHandler
