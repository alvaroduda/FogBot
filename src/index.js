const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes, Options } = require('discord.js');
const config = require('./config/config');

// Tratamento de erros globais para evitar crash silencioso
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Criar nova instância do cliente com intents necessários e otimização de cache
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        ReactionManager: 0,
        GuildMemberManager: {
            maxSize: 200,
            keepOverLimit: member => member.id === client.user.id,
        },
        MessageManager: 10,
        PresenceManager: 0,
        ThreadManager: 0,
        GuildScheduledEventManager: 0,
        StageInstanceManager: 0,
        VoiceStateManager: 0,
    }),
    sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: {
            interval: 300, // 5 minutos
            lifetime: 600, // 10 minutos
        },
    },
});

// Coleção de comandos
client.commands = new Collection();

// Carregar comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.log(`[AVISO] O comando em ${filePath} está faltando a propriedade "data" ou "execute".`);
    }
}

// Carregar eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.on('error', console.error);

// Registrar comandos Slash
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log(`Iniciando atualização de ${commands.length} comandos de aplicação (/)`);

        if (config.clientId && config.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands },
            );
            console.log('Comandos de aplicação (/) recarregados com sucesso.');
        } else {
            console.warn('CLIENT_ID ou GUILD_ID não definidos no .env. Comandos não registrados automaticamente.');
        }
    } catch (error) {
        console.error(error);
    }
})();

// Login
client.login(config.token);

// Manter processo vivo (debug)
setInterval(() => {}, 60000);
