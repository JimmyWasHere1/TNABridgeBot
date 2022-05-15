const fs = require('fs')
const { Collection } = require('discord.js-light')
const { MessageEmbed } = require('discord.js')

class CommandHandler {
  constructor(discord, client) {
    this.discord = discord
    this.client = client

    this.prefix = discord.app.config.discord.prefix

    this.commands = new Collection()
    let commandFiles = fs.readdirSync('./src/discord/commands').filter(file => file.endsWith('.js'))
    for (const file of commandFiles) {
      const command = new (require(`./commands/${file}`))(discord)
      this.commands.set(command.name, command)
    }
  }

  handle(message, client) {
    if (!message.content.startsWith(this.prefix)) {
      return false
    }

    let args = message.content.slice(this.prefix.length).trim().split(/ +/)
    let commandName = args.shift().toLowerCase()

    let command = this.commands.get(commandName)
      || this.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName))

    if (!command) {
      return false
    }

    if ((command.name != 'help' && !this.isCommander(message.member)) || (command.name == 'override' && !this.isOwner(message.author))) {
      const replyEmbed = new MessageEmbed()
      replyEmbed.setColor('DC143C')
      replyEmbed.setTitle(`You don't have permission to do that.`)
      return message.channel.send({
        embeds: [replyEmbed]
      })
    }

    this.discord.app.log.discord(`[${command.name}] ${message.content}`)
    command.onCommand(message, client)

    return true
  }

  isCommander(member) {
    return member.roles.cache.find(r => r.id == this.discord.app.config.discord.commandRole)
  }

  isOwner(member) {
    return member.id == this.discord.app.config.discord.ownerId
  }
}

module.exports = CommandHandler
