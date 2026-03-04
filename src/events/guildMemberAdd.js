const { Events } = require('discord.js');
const config = require('../config/config');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        console.log(`Novo membro entrou: ${member.user.tag}`);
        
        const role = member.guild.roles.cache.find(r => r.name === config.roles.membro);
        if (role) {
            await member.roles.add(role);
            console.log(`Cargo ${config.roles.membro} atribuído a ${member.user.tag}`);
        } else {
            console.warn(`Cargo ${config.roles.membro} não encontrado!`);
        }
    },
};
