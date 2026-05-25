import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { withJsDefaults } from './extension';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter }).$extends(
    withJsDefaults({
        generateSlug: () => "real-slug-" + Math.floor(Math.random() * 10000)
    })
);

async function main() {
    console.log("Attempting to write to the database...");

    const newArticle = await prisma.article.create({
        data: {
            title: "My first article using the custom extension!"
        }
    });

    console.log("Success! Prisma saved the record.");
    console.log("Database record:");
    console.log(newArticle);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());