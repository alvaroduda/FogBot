const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
                } else if (interaction.customId === 'request_creator') {
                    await handleRequestCreator(interaction);
                } else if (interaction.customId === 'approve_creator') {
                    await handleApproveCreator(interaction);
                } else if (interaction.customId === 'deny_creator') {
                    await handleDenyCreator(interaction);
                } else if (interaction.customId === 'add_video') {
                    await handleAddVideo(interaction);
                } else if (interaction.customId === 'confirm_close_creator') {
                    await handleConfirmCloseCreator(interaction);
                } else if (interaction.customId === 'cancel_close') {
                    await interaction.reply({ content: 'Operação cancelada.', ephemeral: true });
                }
            } catch (error) {
                console.error('Erro ao processar botão:', error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Ocorreu um erro ao processar sua solicitação.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Ocorreu um erro ao processar sua solicitação. Verifique o console do bot.', ephemeral: true });
                }
            }
        } else if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId === 'creator_modal') {
                    await handleCreatorModal(interaction);
                } else if (interaction.customId === 'video_modal') {
                    await handleVideoModal(interaction);
                }
            } catch (error) {
                console.error('Erro ao processar modal:', error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Ocorreu um erro ao processar seu formulário.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Ocorreu um erro ao processar seu formulário.', ephemeral: true });
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

    // Verificar se o usuário tem cargo Creator para aplicar desconto
    const creatorRole = guild.roles.cache.find(r => r.name === config.roles.creator);
    const member = guild.members.cache.get(user.id);
    const isCreator = creatorRole && member && member.roles.cache.has(creatorRole.id);
    
    const embed = new EmbedBuilder()
        .setTitle(`Olá, ${user.username}! 👋`)
        .setDescription(
            isCreator 
                ? `🎬 **Creator detectado! Você tem direito a 50% de desconto!**\n\n` +
                  `Fico feliz em saber que você vai dar um passo à frente na sua gameplay usando o Fog Client.\n\n` +
                  `Segue o link de pagamento (Mercado Pago):\n${config.mercadopagoLink}\n\n` +
                  `**💰 Lembre-se:** Você tem direito a 50% de desconto por ser Creator!\n\n` +
                  `**📋 IMPORTANTE - Leia com atenção:**\n` +
                  `• Envie o link do seu canal do **YouTube** ou **TikTok** neste chat\n` +
                  `• Você tem **até 7 dias** após o pagamento para enviar os **3 vídeos gravados** mostrando o Fog Client\n` +
                  `• Se não enviar os vídeos dentro do prazo, **perderá a vantagem recebida**\n\n` +
                  `Após o pagamento, envie o comprovante aqui no chat para prosseguirmos com a liberação.\n\n` +
                  `**Este ticket permanecerá aberto para você enviar seus vídeos.**`
                : `Fico feliz em saber que você vai dar um passo à frente na sua gameplay usando o Fog Client.\n\n` +
                  `Segue o link de pagamento (Mercado Pago):\n${config.mercadopagoLink}\n\n` +
                  `Após o pagamento, envie o comprovante aqui no chat para prosseguirmos com a liberação.`
        )
        .setColor(isCreator ? config.colors.success : config.colors.primary);
    
    // Se for Creator, adicionar campo de progresso de vídeos
    if (isCreator) {
        embed.addFields({ name: '🎬 Vídeos Gravados', value: '0/3', inline: true });
    }

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

    // Se for Creator, adicionar botão para adicionar vídeos
    let components = [row];
    if (isCreator) {
        const videoRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`add_video_${user.id}`)
                    .setLabel('➕ Adicionar Vídeo')
                    .setStyle(ButtonStyle.Primary)
            );
        components.push(videoRow);
    }

    await ticketChannel.send({ content: `${user}`, embeds: [embed], components: components });
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

    // Verificar se é um ticket de Creator e se completou os vídeos
    const creatorRole = guild.roles.cache.find(r => r.name === config.roles.creator);
    let isCreatorTicket = false;
    let videosCompleted = false;
    
    if (channel.name.startsWith('ticket-')) {
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const ticketMessage = messages.find(msg => 
                msg.author.id === guild.client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].fields?.some(f => f.name === '🎬 Vídeos Gravados')
            );
            
            if (ticketMessage) {
                isCreatorTicket = true;
                const videosField = ticketMessage.embeds[0].fields.find(f => f.name === '🎬 Vídeos Gravados');
                if (videosField) {
                    const videos = parseInt(videosField.value.split('/')[0]) || 0;
                    videosCompleted = videos >= 3;
                }
            }
        } catch (error) {
            console.error('Erro ao verificar ticket de Creator:', error);
        }
    }

    // Se for ticket de Creator e não completou os vídeos, avisar
    if (isCreatorTicket && !videosCompleted) {
        const warningRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_close_creator')
                    .setLabel('⚠️ Fechar Mesmo Assim')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

        return interaction.reply({ 
            content: `⚠️ **Atenção!** Este é um ticket de Creator que ainda não completou os 3 vídeos obrigatórios.\n\n` +
                     `O Creator tem até 7 dias para enviar os vídeos. Deseja fechar o ticket mesmo assim?`, 
            components: [warningRow], 
            ephemeral: true 
        });
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

// ========== SISTEMA CREATOR ==========

async function handleRequestCreator(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('creator_modal')
        .setTitle('🎬 Solicitar Tag Creator');

    const platformInput = new TextInputBuilder()
        .setCustomId('platform')
        .setLabel('Plataforma (TikTok ou YouTube)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: TikTok ou YouTube')
        .setRequired(true)
        .setMaxLength(10);

    const linkInput = new TextInputBuilder()
        .setCustomId('link')
        .setLabel('Link do seu perfil/canal')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://...')
        .setRequired(true)
        .setMaxLength(200);

    const followersInput = new TextInputBuilder()
        .setCustomId('followers')
        .setLabel('Número de seguidores/inscritos')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 150')
        .setRequired(true)
        .setMaxLength(10);

    const firstRow = new ActionRowBuilder().addComponents(platformInput);
    const secondRow = new ActionRowBuilder().addComponents(linkInput);
    const thirdRow = new ActionRowBuilder().addComponents(followersInput);

    modal.addComponents(firstRow, secondRow, thirdRow);

    await interaction.showModal(modal);
}

async function handleCreatorModal(interaction) {
    const platform = interaction.fields.getTextInputValue('platform').toLowerCase();
    const link = interaction.fields.getTextInputValue('link');
    const followers = parseInt(interaction.fields.getTextInputValue('followers'));

    // Validar plataforma
    if (platform !== 'tiktok' && platform !== 'youtube') {
        return interaction.reply({ 
            content: '❌ Plataforma inválida! Use apenas "TikTok" ou "YouTube".', 
            ephemeral: true 
        });
    }

    // Validar número de seguidores
    if (isNaN(followers) || followers < 100) {
        return interaction.reply({ 
            content: '❌ Você precisa ter no mínimo 100 seguidores/inscritos para solicitar a tag Creator.', 
            ephemeral: true 
        });
    }

    const { guild, user } = interaction;
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);
    const creatorRole = guild.roles.cache.find(r => r.name === config.roles.creator);

    // Verificar se já tem o cargo Creator
    const member = guild.members.cache.get(user.id);
    if (creatorRole && member.roles.cache.has(creatorRole.id)) {
        return interaction.reply({ 
            content: '✅ Você já possui o cargo Creator!', 
            ephemeral: true 
        });
    }

    // Criar ticket para Creator
    const ticketCategory = guild.channels.cache.find(c => c.name === config.categories.tickets && c.type === ChannelType.GuildCategory);
    if (!ticketCategory) {
        return interaction.reply({ 
            content: '❌ Categoria de tickets não encontrada. Execute /setup novamente.', 
            ephemeral: true 
        });
    }

    const channelName = `creator-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const creatorChannel = await guild.channels.create({
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

    // Embed com informações da solicitação
    const requestEmbed = new EmbedBuilder()
        .setTitle('🎬 Nova Solicitação de Creator')
        .setDescription(`**Usuário:** ${user} (${user.tag})\n**ID:** ${user.id}`)
        .addFields(
            { name: '📱 Plataforma', value: platform.toUpperCase(), inline: true },
            { name: '🔗 Link', value: link, inline: false },
            { name: '👥 Seguidores/Inscritos', value: followers.toString(), inline: true },
            { name: '✅ Requisito Mínimo', value: '100', inline: true },
            { name: '📊 Status', value: followers >= 100 ? '✅ Aprovado' : '❌ Reprovado', inline: true }
        )
        .setColor(followers >= 100 ? config.colors.success : config.colors.error)
        .setTimestamp();

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_creator_${user.id}`)
                .setLabel('✅ Aprovar Creator')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`deny_creator_${user.id}`)
                .setLabel('❌ Negar Solicitação')
                .setStyle(ButtonStyle.Danger)
        );

    await creatorChannel.send({ 
        content: `${user}\n${adminRole ? adminRole : ''} ${atendenteRole ? atendenteRole : ''}`, 
        embeds: [requestEmbed], 
        components: [actionRow] 
    });

    await interaction.reply({ 
        content: `✅ Sua solicitação foi enviada! Um ticket foi criado: ${creatorChannel}\n\nAguarde a análise da nossa equipe.`, 
        ephemeral: true 
    });
}

async function handleApproveCreator(interaction) {
    const { guild, user, channel, message } = interaction;
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);
    const creatorRole = guild.roles.cache.find(r => r.name === config.roles.creator);

    // Verificar se quem clicou é Admin ou Atendente
    const member = guild.members.cache.get(user.id);
    if (!member.roles.cache.has(adminRole.id) && !member.roles.cache.has(atendenteRole.id)) {
        return interaction.reply({ content: '❌ Apenas Administradores e Atendentes podem aprovar criadores.', ephemeral: true });
    }

    // Extrair ID do usuário do customId
    const userId = interaction.customId.split('_').pop();
    const creatorMember = guild.members.cache.get(userId);

    if (!creatorMember) {
        return interaction.reply({ content: '❌ Usuário não encontrado no servidor.', ephemeral: true });
    }

    if (!creatorRole) {
        return interaction.reply({ content: '❌ Cargo Creator não encontrado. Execute /setup novamente.', ephemeral: true });
    }

    // Dar cargo Creator
    await creatorMember.roles.add(creatorRole);

    // Atualizar embed com status de aprovado
    const originalFields = message.embeds[0].fields.map(f => {
        if (f.name === '📊 Status') {
            return { name: '📊 Status', value: '✅ **APROVADO**', inline: true };
        }
        return f;
    });
    
    // Adicionar campo de vídeos se não existir
    if (!originalFields.find(f => f.name === '🎬 Vídeos Gravados')) {
        originalFields.push({ name: '🎬 Vídeos Gravados', value: '0/3', inline: true });
    }
    
    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
        .setColor(config.colors.success)
        .setFields(originalFields);

    const videoRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`add_video_${userId}`)
                .setLabel('➕ Adicionar Vídeo')
                .setStyle(ButtonStyle.Primary)
        );

    await message.edit({ embeds: [updatedEmbed], components: [videoRow] });

    // Enviar mensagem para o criador
    const successEmbed = new EmbedBuilder()
        .setTitle('🎉 Parabéns! Você foi aprovado como Creator!')
        .setDescription(
            'Sua solicitação foi **aprovada** pela nossa equipe!\n\n' +
            '📋 **Próximos passos:**\n' +
            '1. Grave **3 vídeos** mostrando o Fog Client\n' +
            '2. Divulgue a loja em cada vídeo\n' +
            '3. Use o botão abaixo para adicionar cada vídeo após publicar\n\n' +
            '🎁 **Após completar os 3 vídeos:**\n' +
            '• Você receberá **50% de desconto** na compra do Fog Client\n' +
            '• Suporte prioritário\n\n' +
            'Use o botão abaixo para adicionar seus vídeos!'
        )
        .setColor(config.colors.success)
        .setTimestamp();

    const addVideoRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`add_video_${userId}`)
                .setLabel('➕ Adicionar Vídeo')
                .setStyle(ButtonStyle.Primary)
        );

    await channel.send({ content: `<@${userId}>`, embeds: [successEmbed], components: [addVideoRow] });

    await interaction.reply({ content: `✅ Creator aprovado! Cargo atribuído a ${creatorMember.user.tag}`, ephemeral: true });
}

async function handleDenyCreator(interaction) {
    const { guild, user, channel, message } = interaction;
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);

    // Verificar se quem clicou é Admin ou Atendente
    const member = guild.members.cache.get(user.id);
    if (!member.roles.cache.has(adminRole.id) && !member.roles.cache.has(atendenteRole.id)) {
        return interaction.reply({ content: '❌ Apenas Administradores e Atendentes podem negar solicitações.', ephemeral: true });
    }

    // Extrair ID do usuário do customId
    const userId = interaction.customId.split('_').pop();
    const creatorMember = guild.members.cache.get(userId);

    if (!creatorMember) {
        return interaction.reply({ content: '❌ Usuário não encontrado no servidor.', ephemeral: true });
    }

    // Atualizar embed com status negado
    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
        .setColor(config.colors.error)
        .setFields(
            ...message.embeds[0].fields,
            { name: '📊 Status', value: '❌ **NEGADO**', inline: true }
        );

    await message.edit({ embeds: [updatedEmbed], components: [] });

    // Enviar mensagem para o criador
    const denyEmbed = new EmbedBuilder()
        .setTitle('❌ Solicitação Negada')
        .setDescription('Infelizmente sua solicitação de Creator foi negada pela nossa equipe.\n\nSe você acredita que isso foi um erro, entre em contato com um administrador.')
        .setColor(config.colors.error)
        .setTimestamp();

    await channel.send({ content: `<@${userId}>`, embeds: [denyEmbed] });

    await interaction.reply({ content: `❌ Solicitação negada para ${creatorMember.user.tag}`, ephemeral: true });
}

async function handleAddVideo(interaction) {
    const customIdParts = interaction.customId.split('_');
    const userId = customIdParts.length > 2 ? customIdParts.slice(2).join('_') : customIdParts.pop();
    
    // Verificar se é o próprio criador ou staff
    const { guild, user, channel } = interaction;
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);
    const member = guild.members.cache.get(user.id);

    // Verificar se o canal é um ticket creator
    if (!channel.name.startsWith('creator-')) {
        return interaction.reply({ content: '❌ Este comando só pode ser usado em tickets de Creator.', ephemeral: true });
    }

    // Se não for staff, verificar se é o dono do ticket
    const isStaff = (adminRole && member.roles.cache.has(adminRole.id)) || (atendenteRole && member.roles.cache.has(atendenteRole.id));
    if (!isStaff && user.id !== userId) {
        return interaction.reply({ content: '❌ Você não tem permissão para adicionar vídeos neste ticket.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId(`video_modal_${userId}`)
        .setTitle('➕ Adicionar Vídeo');

    const videoLinkInput = new TextInputBuilder()
        .setCustomId('video_link')
        .setLabel('Link do vídeo publicado')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://...')
        .setRequired(true)
        .setMaxLength(200);

    const videoRow = new ActionRowBuilder().addComponents(videoLinkInput);
    modal.addComponents(videoRow);

    await interaction.showModal(modal);
}

async function handleVideoModal(interaction) {
    const customIdParts = interaction.customId.split('_');
    const userId = customIdParts.length > 2 ? customIdParts.slice(2).join('_') : customIdParts.pop();
    const videoLink = interaction.fields.getTextInputValue('video_link');
    const { guild, channel, user } = interaction;

    // Buscar mensagem original com o embed (pode ter ou não o campo de vídeos ainda)
    const messages = await channel.messages.fetch({ limit: 50 });
    const originalMessage = messages.find(msg => 
        msg.embeds.length > 0 && 
        msg.embeds[0].title === '🎬 Nova Solicitação de Creator' &&
        msg.author.id === guild.client.user.id
    );

    if (!originalMessage || !originalMessage.embeds[0]) {
        // Se não encontrar a mensagem original, criar uma nova mensagem com o progresso
        const progressEmbed = new EmbedBuilder()
            .setTitle('✅ Vídeo Adicionado!')
            .setDescription(`**Vídeo adicionado com sucesso!**\n\n**Link:** ${videoLink}\n\nContinue adicionando seus vídeos até completar 3 vídeos para receber o desconto de 50%!`)
            .setColor(config.colors.success)
            .setTimestamp();

        await channel.send({ embeds: [progressEmbed] });
        return interaction.reply({ content: '✅ Vídeo adicionado!', ephemeral: true });
    }

    const embed = originalMessage.embeds[0];
    const videosField = embed.fields.find(f => f.name === '🎬 Vídeos Gravados');
    const currentVideos = videosField ? parseInt(videosField.value.split('/')[0]) || 0 : 0;
    const newVideos = currentVideos + 1;

    // Atualizar embed
    let updatedFields = embed.fields.map(field => {
        if (field.name === '🎬 Vídeos Gravados') {
            return { name: '🎬 Vídeos Gravados', value: `${newVideos}/3`, inline: true };
        }
        return field;
    });
    
    // Se o campo não existia, adicionar
    if (!videosField) {
        updatedFields.push({ name: '🎬 Vídeos Gravados', value: `${newVideos}/3`, inline: true });
    }

    const updatedEmbed = EmbedBuilder.from(embed)
        .setFields(updatedFields)
        .setColor(newVideos >= 3 ? config.colors.success : config.colors.primary);

    const videoRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`add_video_${userId}`)
                .setLabel('➕ Adicionar Vídeo')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(newVideos >= 3)
        );

    await originalMessage.edit({ embeds: [updatedEmbed], components: [videoRow] });

    // Enviar confirmação do vídeo adicionado
    const videoEmbed = new EmbedBuilder()
        .setTitle('✅ Vídeo Adicionado!')
        .setDescription(`**Vídeo ${newVideos}/3** adicionado com sucesso!\n\n**Link:** ${videoLink}`)
        .setColor(config.colors.success)
        .setTimestamp();

    await channel.send({ embeds: [videoEmbed] });

    // Se completou 3 vídeos, enviar mensagem de conclusão
    if (newVideos >= 3) {
        const completionEmbed = new EmbedBuilder()
            .setTitle('🎉 Parabéns! Você completou os 3 vídeos!')
            .setDescription(
                'Você completou todos os requisitos do programa Creator!\n\n' +
                '🎁 **Benefícios desbloqueados:**\n' +
                '• **50% de desconto** na compra do Fog Client\n' +
                '• Suporte prioritário\n\n' +
                'Use o botão abaixo para abrir um ticket de compra com desconto!'
            )
            .setColor(config.colors.success)
            .setTimestamp();

        const buyRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('abrir_ticket')
                    .setLabel('🛒 Comprar com Desconto')
                    .setStyle(ButtonStyle.Success)
            );

        await channel.send({ content: `<@${userId}>`, embeds: [completionEmbed], components: [buyRow] });
    }

    await interaction.reply({ 
        content: `✅ Vídeo adicionado! Progresso: ${newVideos}/3`, 
        ephemeral: true 
    });
}

async function handleConfirmCloseCreator(interaction) {
    const { guild, user, channel } = interaction;
    const config = require('../config/config');

    // Verificar se quem clicou é Admin ou Atendente
    const member = guild.members.cache.get(user.id);
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const atendenteRole = guild.roles.cache.find(r => r.name === config.roles.atendente);

    if (!member.roles.cache.has(adminRole.id) && !member.roles.cache.has(atendenteRole.id)) {
        return interaction.reply({ content: '❌ Apenas Administradores e Atendentes podem fechar o ticket.', ephemeral: true });
    }

    // Perguntar se a venda foi concretizada (mesmo fluxo normal)
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

    await interaction.update({ 
        content: '⚠️ **Ticket de Creator sendo fechado antes de completar os vídeos.**\n\nComo deseja registrar o encerramento deste ticket?', 
        components: [row]
    });
}
