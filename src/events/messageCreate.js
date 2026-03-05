const { Events, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        // Verificar se é canal de ticket
        if (message.channel.name.startsWith('ticket-')) {
            await handleProof(message);
            await handleCreatorVideo(message);
        }
    }
};

async function handleProof(message) {
    const { guild, channel, author, client } = message;

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
    const adminRole = guild.roles.cache.find(r => r.name === config.roles.admin);
    const ticketRole = guild.roles.cache.find(r => r.name === config.roles.ticket);

    // Verificar se o autor é admin ou atendente - se for, não processar
    const member = guild.members.cache.get(author.id);
    if (!member) return;
    
    if (adminRole && member.roles.cache.has(adminRole.id)) return;
    if (atendenteRole && member.roles.cache.has(atendenteRole.id)) return;

    // Verificar se o autor é o dono do ticket (extrair username do nome do canal)
    const ticketUsername = channel.name.replace('ticket-', '').toLowerCase();
    const authorUsername = author.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (ticketUsername !== authorUsername) {
        // Não é o dono do ticket, não processar
        return;
    }

    // Verificar se já foi processado um comprovante neste ticket
    // Buscar mensagens recentes para ver se já existe uma mensagem de comprovante recebido
    try {
        const recentMessages = await channel.messages.fetch({ limit: 50 });
        const hasProofMessage = recentMessages.some(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === '✅ Comprovante Recebido!'
        );

        if (hasProofMessage) {
            // Já foi processado um comprovante neste ticket
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar mensagens anteriores:', error);
    }

    // Remover permissão de falar do usuário (apenas leitura)
    // Manter permissão de ver o canal
    await channel.permissionOverwrites.edit(author, {
        SendMessages: false,
        ViewChannel: true
    });

    // Adicionar permissão para o cargo "ticket" no canal
    // Quando o usuário receber este cargo, poderá falar novamente
    if (ticketRole) {
        await channel.permissionOverwrites.edit(ticketRole, {
            ViewChannel: true,
            SendMessages: true
        });
    }

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
        .setDescription(`Olá ${message.author}, recebemos seu comprovante.\n\nIrei passar o atendimento para um de nossos atendentes reais. O prazo de retorno é de até 48h por este mesmo ticket.\n\n**Atenção:** Um atendente ou administrador irá atribuir o cargo "Ticket" para você poder continuar conversando neste canal.`)
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
                { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true }
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

async function handleCreatorVideo(message) {
    const { guild, channel, author, client } = message;
    
    // Verificar se é um ticket de Creator (usuário com cargo Creator)
    const creatorRole = guild.roles.cache.find(r => r.name === config.roles.creator);
    if (!creatorRole) return;
    
    const member = guild.members.cache.get(author.id);
    if (!member || !member.roles.cache.has(creatorRole.id)) return;
    
    // Verificar se o autor é o dono do ticket
    const ticketUsername = channel.name.replace('ticket-', '').toLowerCase();
    const authorUsername = author.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (ticketUsername !== authorUsername) return;
    
    // Verificar se a mensagem contém link de YouTube ou TikTok
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?(?:vm\.tiktok\.com\/|tiktok\.com\/@[\w.-]+\/video\/)([a-zA-Z0-9]+)/;
    
    const youtubeMatch = message.content.match(youtubeRegex);
    const tiktokMatch = message.content.match(tiktokRegex);
    
    // Aceitar qualquer link HTTP/HTTPS (pode ser YouTube, TikTok ou outro formato)
    const urlRegex = /https?:\/\/[^\s]+/;
    const hasUrl = urlRegex.test(message.content);
    
    if (!youtubeMatch && !tiktokMatch && !hasUrl) return;
    
    const videoLink = youtubeMatch ? `https://youtube.com/watch?v=${youtubeMatch[1]}` : 
                      message.content.match(urlRegex)?.[0] || message.content;
    
    // Buscar mensagem original do ticket para atualizar contador
    try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const originalMessage = messages.find(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            (msg.embeds[0].title.includes('Olá') || msg.embeds[0].title.includes('Creator'))
        );
        
        if (originalMessage) {
            const embed = originalMessage.embeds[0];
            const videosField = embed.fields?.find(f => f.name === '🎬 Vídeos Gravados');
            const currentVideos = videosField ? parseInt(videosField.value.split('/')[0]) || 0 : 0;
            const newVideos = currentVideos + 1;
            
            // Atualizar embed
            let updatedFields = embed.fields ? embed.fields.map(field => {
                if (field.name === '🎬 Vídeos Gravados') {
                    return { name: '🎬 Vídeos Gravados', value: `${newVideos}/3`, inline: true };
                }
                return field;
            }) : [];
            
            // Se o campo não existia, adicionar
            if (!videosField) {
                updatedFields.push({ name: '🎬 Vídeos Gravados', value: `${newVideos}/3`, inline: true });
            }
            
            const updatedEmbed = EmbedBuilder.from(embed)
                .setFields(updatedFields)
                .setColor(newVideos >= 3 ? config.colors.success : config.colors.primary);
            
            // Atualizar componentes do botão
            const existingComponents = originalMessage.components || [];
            let newComponents = [];
            
            if (existingComponents.length > 0) {
                const firstRow = existingComponents[0];
                const videoButton = firstRow.components.find(c => c.customId?.startsWith('add_video_'));
                
                if (videoButton) {
                    const updatedButton = ButtonBuilder.from(videoButton).setDisabled(newVideos >= 3);
                    const updatedRow = ActionRowBuilder.from(firstRow).setComponents([updatedButton]);
                    newComponents.push(updatedRow);
                }
            }
            
            await originalMessage.edit({ embeds: [updatedEmbed], components: newComponents });
            
            // Enviar confirmação
            const videoEmbed = new EmbedBuilder()
                .setTitle('✅ Vídeo Adicionado!')
                .setDescription(`**Vídeo ${newVideos}/3** registrado com sucesso!\n\n**Link:** ${videoLink}`)
                .setColor(config.colors.success)
                .setTimestamp();
            
            await channel.send({ embeds: [videoEmbed] });
            
            // Se completou 3 vídeos
            if (newVideos >= 3) {
                const completionEmbed = new EmbedBuilder()
                    .setTitle('🎉 Parabéns! Você completou os 3 vídeos!')
                    .setDescription(
                        'Você completou todos os requisitos do programa Creator!\n\n' +
                        '🎁 **Benefícios desbloqueados:**\n' +
                        '• **50% de desconto** na compra do Fog Client\n' +
                        '• Suporte prioritário\n\n' +
                        'Seu ticket permanecerá aberto para acompanhamento. Obrigado por divulgar o Fog Client!'
                    )
                    .setColor(config.colors.success)
                    .setTimestamp();
                
                await channel.send({ content: `<@${author.id}>`, embeds: [completionEmbed] });
            }
        }
    } catch (error) {
        console.error('Erro ao processar vídeo do Creator:', error);
    }
}
