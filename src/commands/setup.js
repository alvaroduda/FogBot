const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setupServer } = require('../utils/setup');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Inicializa a configuração do servidor (Apenas Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            await setupServer(interaction.guild);
            await interaction.editReply({ content: '✅ Servidor configurado com sucesso! Cargos, canais e permissões ajustados.' });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Ocorreu um erro ao configurar o servidor:\n\`\`\`${error}\`\`\`` });
        }
    },
};
