const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            try {
                if (interaction.customId === 'abrir_ticket') {
                    console.log(`Recebido pedido de ticket de: ${interaction.user.tag}`);
                    await handleOpenTicket(interaction);
                } else if (interaction.customId === 'close_ticket') {
                    console.log(`Recebido pedido de fechar ticket de: ${interaction.user.tag}`);
                    await handleCloseTicket(interaction);
                } else if (interaction.customId === 'confirm_sale_yes') {
                    await finalizeTicket(interaction, true);
                } else if (interaction.customId === 'confirm_sale_no') {
                    await finalizeTicket(interaction, false);
                }
            } catch (error) {
                console.error('Erro ao processar botão:', error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Ocorreu um erro ao processar sua solicitação.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Ocorreu um erro ao processar sua solicitação. Verifique o console do bot.', ephemeral: true });
                }
            }
        }
    },
};

async function handleOpenTicket(interaction) {
    const { guild, user } = interaction;
    // O config já está importado no topo, não precisa reimportar, mas vamos garantir
    // const config = require('../config/config'); 

    console.log('Iniciando criação de ticket...');

    // 0. Fetch atualizado para garantir cache fresco
    // await guild.roles.fetch();
    // await guild.channels.fetch();

    // Verificar se já existe ticket
    const ticketNamePattern = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const existingTicket = guild.channels.cache.find(c => c.name.includes(ticketNamePattern) && c.type === ChannelType.GuildText);
    
    if (existingTicket) {
        console.log(`Ticket já existente: ${existingTicket.name}`);
        return interaction.reply({ content: `Você já possui um ticket aberto: ${existingTicket}`, ephemeral: true });
    }

    const ticketCategory = guild.channels.cache.find(c => c.name === config.categories.tickets && c.type === ChannelType.GuildCategory);
    if (!ticketCategory) {
        console.error(`Categoria não encontrada: ${config.categories.tickets}`);
        return interaction.reply({ content: 'Categoria de tickets não encontrada. Execute /setup novamente.', ephemeral: true });
    }

    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);

    if (!adminRole || !atendenteRole) {
        console.error('Cargos não encontrados');
        return interaction.reply({ content: 'Cargos de suporte não encontrados. Execute /setup novamente.', ephemeral: true });
    }

    const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    console.log(`Criando canal: ${channelName}`);
    
    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
            },
            {
                id: atendenteRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            },
            {
                id: adminRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            }
        ]
    });

    console.log(`Canal criado com sucesso: ${ticketChannel.id}`);

    const embed = new EmbedBuilder()
        .setTitle(`Olá, ${user.username}! 👋`)
        .setDescription(`Fico feliz em saber que você vai dar um passo à frente na sua gameplay usando o Fog Client.\n\nSegue o link de pagamento (Mercado Pago):\n${config.mercadopagoLink}\n\nApós o pagamento, envie o comprovante aqui no chat para prosseguirmos com a liberação.`)
        .setColor(config.colors.primary);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('🔗 Pagar com Mercado Pago')
                .setStyle(ButtonStyle.Link)
                .setURL(config.mercadopagoLink),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('🔒 Fechar Ticket')
                .setStyle(ButtonStyle.Danger)
        );

    await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `Ticket criado: ${ticketChannel}`, ephemeral: true });
}

async function handleCloseTicket(interaction) {
    const { guild, user, channel } = interaction;
    // Garantir acesso ao config
    const config = require('../config/config');

    // Verificar se quem clicou é Admin ou Atendente
    const member = guild.members.cache.get(user.id);
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);

    if (!member.roles.cache.has(adminRole.id) && !member.roles.cache.has(atendenteRole.id)) {
        return interaction.reply({ content: '❌ Apenas Administradores e Atendentes podem fechar o ticket.', ephemeral: true });
    }

    // Perguntar se a venda foi concretizada
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_sale_yes')
                .setLabel('✅ Venda Concluída')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('confirm_sale_no')
                .setLabel('❌ Venda Não Concluída')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({ 
        content: 'Como deseja registrar o encerramento deste ticket?', 
        components: [row], 
        ephemeral: true 
    });
}

async function finalizeTicket(interaction, success) {
    const { guild, user, channel } = interaction;
    const config = require('../config/config');

    const logsChannel = guild.channels.cache.find(c => c.name === config.channels.salesLogs);
    
    // Identificar o dono do ticket pelo nome do canal ou tópico (simplificado pelo nome por enquanto)
    // ticket-username -> username
    const ticketOwnerName = channel.name.replace('ticket-', '');
    
    if (logsChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle(success ? '💰 Venda Concluída' : '🔒 Ticket Fechado (Sem Venda)')
            .addFields(
                { name: 'Fechado por', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Ticket de', value: ticketOwnerName, inline: true },
                { name: 'Canal', value: channel.name, inline: true },
                { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true }
            )
            .setColor(success ? config.colors.success : config.colors.error)
            .setTimestamp();

        try {
            await logsChannel.send({ embeds: [logEmbed] });
        } catch (error) {
            console.error('Erro ao enviar log:', error);
        }
    }

    // Se a venda foi concluída, tentar dar o cargo de Cliente se possível (opcional, mas recomendado)
    if (success) {
        // Lógica futura: encontrar o membro pelo nome/ID e dar cargo
    }

    await interaction.update({ content: '🔒 Ticket será excluído em 5 segundos...', components: [] });
    setTimeout(() => {
        channel.delete().catch(console.error);
    }, 5000);
}
