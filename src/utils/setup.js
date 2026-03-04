const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

async function setupServer(guild) {
    try {
        console.log('Iniciando configuração do servidor...');

        // 0. Fetch atualizado de Roles e Channels
        await guild.roles.fetch();
        await guild.channels.fetch();

        // 1. Criar Cargos
        const roles = {};
        for (const [key, roleName] of Object.entries(config.roles)) {
            let role = guild.roles.cache.find(r => r.name === roleName);
            if (!role) {
                console.log(`Criando cargo: ${roleName}`);
                try {
                    role = await guild.roles.create({
                        name: roleName,
                        color: key === 'admin' ? '#FF0000' : key === 'atendente' ? '#00FF00' : key === 'cliente' ? '#0000FF' : '#99AAB5',
                        permissions: key === 'admin' ? [PermissionFlagsBits.Administrator] : [],
                        reason: 'Setup inicial do FogBot'
                    });
                } catch (err) {
                    console.error(`Erro ao criar cargo ${roleName}:`, err);
                    throw new Error(`Falha ao criar cargo ${roleName}: ${err.message}`);
                }
            } else {
                // Se o cargo já existe, forçar reconfiguração para garantir integridade
                console.log(`Verificando integridade do cargo: ${roleName}`);
                
                if (key === 'admin') {
                    // Admin SEMPRE deve ser admin
                    if (!role.permissions.has(PermissionFlagsBits.Administrator)) {
                        console.log(`-> Corrigindo Admin: Adicionando permissão de Administrador.`);
                        await role.setPermissions([PermissionFlagsBits.Administrator]);
                    }
                } else {
                    // Resetar permissões de todos os outros cargos para o padrão seguro
                    console.log(`-> Resetando permissões de ${roleName} para o padrão seguro.`);
                    await role.setPermissions([
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]);
                }
            }
            roles[key] = role;
        }

        // 2. Configurar #chat
        let chatChannel = guild.channels.cache.find(c => c.name === config.channels.chat);
        
        console.log(`Configurando canal principal: ${config.channels.chat}`);
        
        if (chatChannel) {
            console.log(`Canal ${config.channels.chat} encontrado. Atualizando permissões...`);
            await chatChannel.permissionOverwrites.set([
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.SendMessages],
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                },
                {
                    id: roles.membro.id,
                    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                },
                {
                    id: roles.cliente.id,
                    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                },
                {
                    id: roles.atendente.id,
                    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                },
                {
                    id: roles.admin.id,
                    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                }
            ]);
            console.log(`Permissões do ${config.channels.chat} atualizadas.`);
        } else {
            console.log(`Canal ${config.channels.chat} não encontrado. Criando...`);
            chatChannel = await guild.channels.create({
                name: config.channels.chat,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.SendMessages],
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: roles.membro.id,
                        allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: roles.cliente.id,
                        allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: roles.atendente.id,
                        allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                    },
                    {
                        id: roles.admin.id,
                        allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                    }
                ]
            });
        }

        // 3. Configurar Categorias e Canais
        const categories = [
            {
                name: config.categories.info,
                channels: [
                    { name: config.channels.welcome, type: ChannelType.GuildText },
                    { name: config.channels.rules, type: ChannelType.GuildText },
                    { name: config.channels.announcements, type: ChannelType.GuildText }
                ]
            },
            {
                name: config.categories.sales,
                channels: [
                    { 
                        name: config.channels.buyNow, 
                        type: ChannelType.GuildText,
                        setup: async (channel) => {
                            // Enviar embed de compra
                            const messages = await channel.messages.fetch({ limit: 10 });
                            if (messages.size === 0) {
                                const embed = new EmbedBuilder()
                                    .setTitle('🛒 Compre Agora o Fog Client')
                                    .setDescription('Clique no botão abaixo para iniciar sua compra e receber atendimento exclusivo.')
                                    .setColor('#00FF00')
                                    .setFooter({ text: 'Fog Client • Sistema de Vendas' });

                                const row = new ActionRowBuilder()
                                    .addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('abrir_ticket')
                                            .setLabel('🛒 Abrir Ticket de Compra')
                                            .setStyle(ButtonStyle.Success)
                                    );

                                await channel.send({ embeds: [embed], components: [row] });
                            }
                        }
                    }
                ]
            },
            {
                name: config.categories.tickets,
                channels: [] // Canais criados dinamicamente
            },
            {
                name: config.categories.support,
                channels: [
                    { name: config.channels.salesLogs, type: ChannelType.GuildText }
                ]
            }
        ];

        for (const catConfig of categories) {
            let category = guild.channels.cache.find(c => c.name === catConfig.name && c.type === ChannelType.GuildCategory);
            
            console.log(`Configurando categoria: ${catConfig.name}`);
            
            if (!category) {
                console.log(`Categoria ${catConfig.name} não encontrada. Criando...`);
                category = await guild.channels.create({
                    name: catConfig.name,
                    type: ChannelType.GuildCategory
                });
            } else {
                 console.log(`Categoria ${catConfig.name} encontrada.`);
            }

            // Forçar permissões da categoria
            console.log(`Atualizando permissões da categoria ${catConfig.name}...`);
            await category.permissionOverwrites.set([
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.SendMessages],
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                },
                {
                    id: roles.admin.id,
                    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
                },
                {
                    id: roles.atendente.id,
                    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                }
            ]);

            // Se for categoria de tickets, negar visualização para everyone
            if (catConfig.name === config.categories.tickets || catConfig.name === config.categories.suporte) {
                await category.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
                await category.permissionOverwrites.edit(roles.membro, { ViewChannel: false });
                await category.permissionOverwrites.edit(roles.cliente, { ViewChannel: false });
            }

            // Criar/Sincronizar canais da categoria
            for (const chConfig of catConfig.channels) {
                let channel = guild.channels.cache.find(c => c.name === chConfig.name && c.parentId === category.id);
                
                console.log(`Configurando canal: ${chConfig.name}`);

                if (!channel) {
                    console.log(`Canal ${chConfig.name} não encontrado na categoria. Criando...`);
                    channel = await guild.channels.create({
                        name: chConfig.name,
                        type: chConfig.type,
                        parent: category.id
                    });
                }

                // Sincronizar permissões com a categoria
                console.log(`Sincronizando permissões do canal ${chConfig.name}...`);
                await channel.lockPermissions();

                // Setup específico do canal (ex: enviar mensagem de compra)
                if (chConfig.setup) {
                    console.log(`Executando setup específico para ${chConfig.name}...`);
                    await chConfig.setup(channel);
                }
            }
        }

        // 4. Atribuir cargo Membro a todos (Movido para o final para não bloquear a estrutura)
        console.log('Verificando membros para atribuir cargo...');
        try {
            const members = await guild.members.fetch();
            console.log(`Total de membros encontrados: ${members.size}`);
            
            let count = 0;
            for (const member of members.values()) {
                if (!member.user.bot && !member.roles.cache.has(roles.membro.id)) {
                    try {
                        await member.roles.add(roles.membro);
                        count++;
                        if (count % 10 === 0) console.log(`Atribuído cargo a ${count} membros...`);
                    } catch (e) {
                        console.warn(`Não foi possível adicionar cargo ao membro ${member.user.tag}: ${e.message}`);
                    }
                }
            }
            if (count > 0) console.log(`Atribuição finalizada. Total de membros atualizados: ${count}`);
            else console.log('Nenhum membro precisou receber o cargo.');
            
        } catch (e) {
            console.warn('Erro ao buscar membros:', e);
        }

        console.log('Configuração concluída com sucesso!');
        return true;
    } catch (error) {
        console.error('Erro no setup:', error);
        throw error;
    }
}

module.exports = { setupServer };
