import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { withJsDefaults } from '../src/extension';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const mockConfig = {
    models: {
        User: { hash: 'generateHash' },
        Article: { slug: 'generateSlug' },
        Comment: { publicId: 'generateCommentId' }
    },
    relations: {
        User: { articles: 'Article' },
        Article: { author: 'User', comments: 'Comment' },
        Comment: { article: 'Article' }
    }
} as any;

const prisma = new PrismaClient({ adapter }).$extends(
    withJsDefaults(mockConfig, {
        generateHash: () => "TEST_HASH_" + Math.floor(Math.random() * 10000),
        generateSlug: (data) => data?.title ? `dynamic-slug-for-${data.title.replace(' ', '-').toLowerCase()}` 
        : "fallback-slug-" + Math.floor(Math.random() * 10000),
        generateCommentId: () => "CMD-" + Math.random().toString(36).substring(7).toUpperCase()
    })
);

describe('Prisma JS Defaults Extension (Runtime on Real DB)', () => {
    
    beforeAll(async () => {
        // @ts-ignore
        await prisma.comment.deleteMany();
        // @ts-ignore
        await prisma.article.deleteMany();
        // @ts-ignore
        await prisma.user.deleteMany();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('should correctly apply defaults to deeply nested CREATE queries', async () => {
        const newUser = await (prisma as any).user.create({
            data: {
                name: "Integration Test User",
                articles: {
                    create: [
                        { 
                            title: "Deep Testing",
                            comments: {
                                create: [ { text: "Comment 1" }, { text: "Comment 2" } ]
                            }
                        }
                    ]
                }
            },
            include: { articles: { include: { comments: true } } }
        });

        expect(newUser.hash).toBeDefined();
        expect(newUser.hash).toMatch(/^TEST_HASH_/);

        expect(newUser.articles).toHaveLength(1);
        expect(newUser.articles[0].slug).toBeDefined();
        expect(newUser.articles[0].slug).toBe('dynamic-slug-for-deep-testing');

        expect(newUser.articles[0].comments).toHaveLength(2);
        expect(newUser.articles[0].comments[0].publicId).toMatch(/^CMD-/);
        expect(newUser.articles[0].comments[1].publicId).toMatch(/^CMD-/);
    });

    it('should correctly apply defaults using createMany', async () => {
        await (prisma as any).user.createMany({
            data: [
                { name: "Many User 1" },
                { name: "Many User 2" }
            ]
        });

        const users = await (prisma as any).user.findMany({
            where: { name: { startsWith: "Many User" } }
        });

        expect(users).toHaveLength(2);
        expect(users[0].hash).toMatch(/^TEST_HASH_/);
        expect(users[1].hash).toMatch(/^TEST_HASH_/);
    });

    it('should correctly apply defaults using createManyAndReturn', async () => {
        const users = await (prisma as any).user.createManyAndReturn({
            data: [
                { name: "Return User 1" },
                { name: "Return User 2" }
            ]
        });

        expect(users).toHaveLength(2);
        expect(users[0].hash).toBeDefined();
        expect(users[0].hash).toMatch(/^TEST_HASH_/);
        expect(users[1].hash).toBeDefined();
        expect(users[1].hash).toMatch(/^TEST_HASH_/);
    });

    it('should correctly apply defaults using upsert', async () => {
        const upsertedUser = await (prisma as any).user.upsert({
            where: { id: 999999 }, 
            update: {}, 
            create: { name: "Upsert User" } 
        });

        expect(upsertedUser.name).toBe("Upsert User");
        expect(upsertedUser.hash).toBeDefined();
        expect(upsertedUser.hash).toMatch(/^TEST_HASH_/);
    });

    it('should not mutate the original input object (Pure Function check)', async () => {
        const inputData = { name: "Immutable User" }; 
        
        await (prisma as any).user.create({
            data: inputData 
        });

        expect(inputData).not.toHaveProperty('hash');
    });

    it('should throw an error if a user generator function fails', async () => {
        const badPrisma = new PrismaClient({ adapter }).$extends(
            withJsDefaults(mockConfig, {
                generateHash: () => { 
                    throw new Error("Bad input");
                },
                generateSlug: () => "test-slug",
                generateCommentId: () => "test-id"
            })
        ) as any;

        await expect(
            badPrisma.user.create({ data: { name: "Crash Test Dummy" } })
        ).rejects.toThrow(/Error executing your function "generateHash"/);
    });
});