const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client with query logging in dev
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Enforce foreign key constraints in SQLite
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
  prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;').catch((err) => {
    console.warn('SQLite PRAGMA foreign_keys setup notice:', err.message);
  });
}

module.exports = prisma;
