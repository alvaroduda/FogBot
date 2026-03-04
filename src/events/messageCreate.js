const { Events, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        // Verificar se é canal de ticket
        if (message.channel.name.startsWith('ticket-')) {
            await handleProof(message);
        }
    }
};

async function handleProof(message) {
    const { guild, channel, author } = message;

    // Verificar se o usuário tem permissão para enviar mensagens (evitar loops em tickets já fechados)
    if (!channel.permissionsFor(author).has(PermissionFlagsBits.SendMessages)) return;

    // Verificar se tem anexo
    if (message.attachments.size === 0) return;

    const attachment = message.attachments.first();
    const contentType = attachment.contentType || ''; 
    const isProof = contentType.startsWith('image/') || contentType === 'application/pdf';

    if (!isProof) return;

    const config = require('../config/config');
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);
    const clienteRole = guild.roles.cache.find(r => r.name === config.roles.cliente);
    const membroRole = guild.roles.cache.find(r => r.name === config.roles.membro);
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);

    // Remover permissão de falar do usuário (apenas leitura)
    // Manter permissão de ver o canal
    await channel.permissionOverwrites.edit(author, {
        SendMessages: false,
        ViewChannel: true
    });

    // Garantir que Staff continue vendo e falando
    if (atendenteRole) {
        await channel.permissionOverwrites.edit(atendenteRole, {
            ViewChannel: true,
            SendMessages: true
        });
    }
    if (adminRole) {
        await channel.permissionOverwrites.edit(adminRole, {
            ViewChannel: true,
            SendMessages: true
        });
    }

    // Enviar embed de confirmação
    const embed = new EmbedBuilder()
        .setTitle('✅ Comprovante Recebido!')
        .setDescription(`Olá ${message.author}, recebemos seu comprovante.\n\nIrei passar o atendimento para um de nossos atendentes reais. O prazo de retorno é de até 48h por este mesmo ticket.\n\nPor favor, aguarde.`)
        .setColor(config.colors.success)
        .setTimestamp();

    await message.channel.send({ embeds: [embed] });

    // Enviar Painel de Fechamento (Visível apenas para Staffs usarem)
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('🔒 Fechar Ticket (Staff)')
                .setStyle(ButtonStyle.Danger)
        );
    
    await message.channel.send({ 
        content: '🛑 **Painel Administrativo:** Apenas Staff pode usar este botão.', 
        components: [row] 
    });

    // Enviar log de comprovante para o canal de logs
    const logsChannel = guild.channels.cache.find(c => c.name === config.channels.salesLogs);
    if (logsChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle('📄 Novo Comprovante Recebido')
            .addFields(
                { name: 'Usuário', value: `${author.tag} (${author.id})`, inline: true },
                { name: 'Canal', value: channel.name, inline: true },
                { name: 'Data', value: new Date().toLocaleString(), inline: true }
            )
            .setColor(config.colors.warning)
            .setTimestamp();

        try {
            await logsChannel.send({ embeds: [logEmbed] });
        } catch (error) {
            console.error('Erro ao enviar log:', error);
        }
    }
}
