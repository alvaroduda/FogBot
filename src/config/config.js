require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  mercadopagoLink: process.env.MERCADOPAGO_LINK || 'https://mpago.li/1WfJYXx',
  colors: {
    primary: 0x0099ff,
    success: 0x00ff00,
    error: 0xff0000,
    warning: 0xffff00
  },
  roles: {
    admin: 'Administrador',
    atendente: 'Atendente',
    cliente: 'Cliente',
    membro: 'Membro'
  },
  categories: {
    info: '📌 INFORMAÇÕES',
    sales: '🛒 VENDAS',
    tickets: '🎫 TICKETS',
    support: '📢 SUPORTE & LOGS'
  },
  channels: {
    welcome: 'boas-vindas',
    rules: 'regras',
    announcements: 'anuncios',
    buyNow: 'compre-agora',
    salesLogs: 'logs-vendas',
    chat: 'chat'
  }
};
