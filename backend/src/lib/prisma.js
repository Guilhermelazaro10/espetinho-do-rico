const { PrismaClient } = require('@prisma/client');

// Singleton: uma única conexão compartilhada por toda a aplicação
const prisma = new PrismaClient();

module.exports = prisma;
