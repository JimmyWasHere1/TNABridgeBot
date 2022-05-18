const DiscordCommand = require('../../contracts/DiscordCommand')
const fetch = require('node-fetch')
const { MessageEmbed } = require('discord.js')

class WeightCheckCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)

    this.name = 'setrole'
    this.aliases = ['sr']
    this.description = 'Set role depending on user weight'
  }

  bonzoRole
  lividRole
  necronRole
  eliteRole

  async onCommand(message) {
    let apiKeyAvailable = await fetch(`https://api.hypixel.net/key?key=${this.discord.app.config.minecraft.api_key}`)
    if (await apiKeyAvailable.json().status === 403) {
      let apiUnavailable = new MessageEmbed()
      apiUnavailable.setTitle('Api key expired or not available. Try again in a couple seconds')
      apiUnavailable.setColor('F04947')
      message.channel.send({
        embeds: [apiUnavailable]
      })
      this.sendMinecraftMessage('/api new')
      return
    }

    this.bonzoRole = message.guild.roles.cache.find(r => r.id === this.discord.app.config.discord.bonzoRole)
    this.lividRole = message.guild.roles.cache.find(r => r.id === this.discord.app.config.discord.lividRole)
    this.necronRole = message.guild.roles.cache.find(r => r.id === this.discord.app.config.discord.necronRole)
    this.eliteRole = message.guild.roles.cache.find(r => r.id === this.discord.app.config.discord.eliteRole)

    let args = this.getArgs(message)
    let user = message.mentions.members.first()
    let userUUID = ''

    if (!args[0]) {
      const invalidArgsEmbed = new MessageEmbed()
      invalidArgsEmbed.setColor('#F04947')
      invalidArgsEmbed.setTitle('invalid args provided. Only \'all\' and \'@player\' available')
      message.channel.send({
        embeds: [invalidArgsEmbed]
      })
      return
    }


    if (args[0] !== 'all' && !args[0].startsWith('<@')) {
      const invalidArgsEmbed = new MessageEmbed()
      invalidArgsEmbed.setColor('#F04947')
      invalidArgsEmbed.setTitle('invalid args provided. Only \'all\' and \'@player\' available')
      message.channel.send({
        embeds: [invalidArgsEmbed]
      })
      return
    }

    if (args[0] === 'all') {
      this.setAllPlayersRank(message)
      return
    }

    let username = user.nickname ? user.nickname : user.user.username
    userUUID = await this.getMinecraftUUID(username)

    if (!userUUID) {
      const replyEmbed = new MessageEmbed()
      replyEmbed.setColor('#F04947')
      replyEmbed.setTitle('User with this name is not found')
      message.channel.send({
        embeds: [replyEmbed]
      })
      return
    }
    const totalWeight = await this.getWeight(userUUID.id)
    const player_rank = this.getPlayerRank(totalWeight[userUUID.id])

    this.givePlayerRank(user.id, player_rank, message)
  }

  async fetcher(link) {
    const response = await fetch(link, {
      method: 'GET',
      headers: { 'Authorization': this.discord.app.config.minecraft.api_key, 'Content-type': 'json' }
    })
    return response.json()
  }

  async setAllPlayersRank(message) {
    let allGuildMembersIDs
    let discordMembers = []
    await message.channel.guild.members
      .fetch()
      .then((members) =>
        allGuildMembersIDs = members.filter(m => m.roles.cache.some(role => role === this.bonzoRole || role === this.lividRole || role === this.necronRole || role === this.eliteRole)))
    let userIDs = Array.from(allGuildMembersIDs).flat().filter((array, index) => index % 2 === 0)
    for (const userID of userIDs) {
      await this.discord.client.guilds.fetch(this.discord.app.config.discord.guildID).then(async guild => {
        let member = await guild.members.fetch(userID)
        const nick = member.nickname ? member.nickname : member.user.username
        discordMembers.push([member.id, nick])
      })
    }
    this.getUserIDAndWeight(discordMembers, message)
  }

  async getUserIDAndWeight(members, message) {
    let usersArray = []
    const loadingEmbed = new MessageEmbed()
    loadingEmbed.setColor('#FFFF00')
    loadingEmbed.setTitle('Loading...')


    const loadingMessage = await message.channel.send({
      embeds: [loadingEmbed]
    })
    let dots = 1
    const loadingAnimation = setInterval(() => {
      const animationEmbed = new MessageEmbed()
      animationEmbed.setColor('#FFFF00')
      animationEmbed.setTitle('Loading' + '.'.repeat(dots))
      loadingMessage.edit({
        embeds: [animationEmbed]
      })
      dots++
      if (dots > 3) dots = 1
    }, 1000)
    const interval = setInterval(async () => {
      if (!members.length) {
        clearInterval(interval)
        this.processGuildMembers(usersArray, loadingMessage, loadingAnimation)
      }
      let firstTen = members.splice(0, 10)
      for (const member of firstTen) {
        this.getMinecraftUUID(member[1]).then(async uuid => {
          if (!uuid) return
          let userInfo = {
            discordId: member[0],
            ign: member[1]
          }
          let userWeight = await this.getWeight(uuid.id)
          userInfo.minecraftUUID = Object.keys(userWeight)[0]
          userInfo.weight = userWeight[Object.keys(userWeight)[0]]
          usersArray.push(userInfo)
        })
      }
    }, 12000) //12 seconds for 10 members = 50 users or 100 requests /min
  }

  async processGuildMembers(membersArray, message, loadingAnimation) {
    let anyoneChanged = false
    const ingameGuild = await fetch(`https://api.hypixel.net/guild?key=${this.discord.app.config.minecraft.api_key}&id=602915918ea8c9cb50ede5fd`).then(g => g.json())
    const guildMembers = ingameGuild.guild.members
    let membersToChange = []
    const returnEmbed = new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Members check done!')
      .setAuthor({ name: 'TNA', iconURL: 'https://i.imgur.com/bdNxeHt.jpeg' })
      .setDescription('Here\'s all users that got changed')
      .setThumbnail('https://i.imgur.com/bdNxeHt.jpeg')
      .setTimestamp()
    for (const member of membersArray) {
      let currentUser
      const realPlayerRank = this.getPlayerRank(member.weight)
      let userRoles = []
      await this.discord.client.guilds.fetch(this.discord.app.config.discord.guildID).then(guild => {
        guild.members.fetch(member.discordId).then(user => {
          userRoles = user._roles
          currentUser = user
        })
      })

      if (!userRoles.some(roles => roles === realPlayerRank.id)) {
        anyoneChanged = true
        returnEmbed.addField(`${member.ign}`, `Weight: ${member.weight.toFixed(0)} \n Relevant role: ${realPlayerRank.name}`, true)
        currentUser.roles.add(realPlayerRank)
      }

      switch (realPlayerRank.name) {
        case this.bonzoRole.name:
          if (userRoles.some(roles => roles === this.lividRole.id || roles === this.necronRole.id || roles === this.eliteRole.id)) {
            anyoneChanged = true
            returnEmbed.addField(`${member.ign}`, `Weight: ${member.weight.toFixed(0)} \n Relevant role: ${realPlayerRank.name}`, true)
            currentUser.roles.remove(this.lividRole)
            currentUser.roles.remove(this.necronRole)
            currentUser.roles.remove(this.eliteRole)
          }
          break
        case this.lividRole.name:
          if (userRoles.some(roles => roles === this.necronRole.id || roles === this.eliteRole.id)) {
            anyoneChanged = true
            returnEmbed.addField(`${member.ign}`, `Weight: ${member.weight.toFixed(0)} \n Relevant role: ${realPlayerRank.name}`, true)
            currentUser.roles.remove(this.necronRole)
            currentUser.roles.remove(this.eliteRole)
          }
          break
        case this.necronRole.name:
          if (userRoles.some(roles => roles === this.eliteRole.id)) {
            anyoneChanged = true
            returnEmbed.addField(`${member.ign}`, `Weight: ${member.weight.toFixed(0)} \n Relevant role: ${realPlayerRank.name}`, true)
            currentUser.roles.remove(this.eliteRole)
          }
          break
      }
      guildMembers.forEach(guildMember => {
        if (guildMember.uuid === member.minecraftUUID) {
          let promotion
          let times
          if (guildMember.rank.toLowerCase() === realPlayerRank.name.toLowerCase() || guildMember.rank.toLowerCase() === 'staff'){
            return
          }
          switch(guildMember.rank.toLowerCase()) {
            case 'bonzo':
              switch (realPlayerRank.name.toLowerCase()){
                case 'livid':
                  promotion = true
                  times = 1
                  break
                case 'necron':
                  promotion = true
                  times = 2
                  break
                case 'elite':
                  promotion = true
                  times = 3
              }
              break

            case 'livid':
              switch (realPlayerRank.name.toLowerCase()) {
                case 'bonzo':
                  promotion = false
                  times = 1
                  break
                case 'necron':
                  promotion = true
                  times = 1
                  break
                case 'elite':
                  promotion = true
                  times = 2
                  break
              }
              break

            case 'necron':
              switch (realPlayerRank.name.toLowerCase()) {
                case 'bonzo':
                  promotion = false
                  times = 2
                  break
                case 'livid':
                  promotion = false
                  times = 1
                  break
                case 'elite':
                  promotion = true
                  times = 1
                  break
              }
              break

            case 'elite':
              switch (realPlayerRank.name.toLowerCase()) {
                case 'bonzo':
                  promotion = false
                  times = 3
                  break
                case 'livid':
                  promotion = false
                  times = 2
                  break
                case 'necron':
                  promotion = false
                  times = 1
              }
          }
          membersToChange.push({ign: member.ign, promote: promotion, times: times})
        }
      })
    }

    const rolesGiver = setInterval(() => {
      if (!membersToChange.length) {
        clearInterval(rolesGiver)
      }
      let firstTwo = membersToChange.splice(0, 2)
      firstTwo.forEach(member => {
        for (let i = 0; i < member.times; i++) {
          if (member.promotion) {
            this.sendMinecraftMessage(`/promote ${member.ign}`)
          } else {
            this.sendMinecraftMessage(`/demote ${member.ign}`)
          }
        }
      })

    }, )

    if (!anyoneChanged) {
      returnEmbed.addField('No one got changed.', 'Wow!')
    }

    clearInterval(loadingAnimation)

    message.edit({
        embeds: [returnEmbed] })
  }

  async getWeight(userUUIDs) {
    let uuidArray = []
    let returnValue = {}
    if (!Array.isArray(userUUIDs)) {
      uuidArray.push(userUUIDs)
    } else {
      uuidArray = [...userUUIDs]
    }

    for (const uuid of uuidArray) {
      const userInfo = await this.fetcher(`https://hypixel-api.senither.com/v1/profiles/${uuid}/weight`)
      returnValue[uuid] = userInfo.data.weight + userInfo.data.weight_overflow
    }
    return returnValue
  }

  getPlayerRank(totalWeight) {
    const bonzoReq = this.discord.app.config.minecraft.bonzo
    const lividReq = this.discord.app.config.minecraft.livid
    const necronReq = this.discord.app.config.minecraft.necron
    const eliteReq = this.discord.app.config.minecraft.elite

    switch (true) {
      case (totalWeight < lividReq):
        return this.bonzoRole
      case (totalWeight < necronReq):
        return this.lividRole
      case (totalWeight < eliteReq):
        return this.necronRole
      default:
        return this.eliteRole
    }
  }

  async getMinecraftUUID(username) {
    let returnValue
    try {
      returnValue = await this.fetcher(`https://api.mojang.com/users/profiles/minecraft/${username}`)
    } catch (e) {
      returnValue = false
    }
    return returnValue
  }

  async givePlayerRank(discordID, role, message) {
    let member
    await this.discord.client.guilds.fetch(this.discord.app.config.discord.guildID).then(async guild => {
      member = await guild.members.fetch(discordID)
    })
    member.roles.add(role)
    let replyEmbed = new MessageEmbed()
    replyEmbed.setColor('47F049')
    replyEmbed.setTitle(`${role.name} role added.`)
    message.channel.send({ embeds: [replyEmbed] })
  }
}

module.exports = WeightCheckCommand
