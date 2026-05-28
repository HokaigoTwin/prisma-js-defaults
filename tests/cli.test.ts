import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const generatedJsPath = path.join(process.cwd(), 'prisma', 'generated', 'js-defaults', 'index.js');
const generatedMjsPath = path.join(process.cwd(), 'prisma', 'generated', 'js-defaults', 'index.mjs');
const generatedDtsPath = path.join(process.cwd(), 'prisma', 'generated', 'js-defaults', 'index.d.ts');

function runCliParser(schemaPath: string) {
    const cmd = `npx tsx src/cli.ts --schema=${schemaPath} --skip-generate`;
    execSync(cmd, { stdio: 'ignore' }); 
}

const FIXTURES = {
    CLASSIC: './tests/fixtures/classic/prisma/schema.prisma',
    MULTI: './tests/fixtures/multi-file/prisma',
    CUSTOM_SINGLE: './tests/fixtures/custom-path/db/custom.prisma',
    CUSTOM_MULTI: './tests/fixtures/custom-multi/db',
    INVALID: './tests/fixtures/does-not-exist/schema.prisma'
};

const validTestCases = [
    {
        name: 'classic single schema file',
        targetPath: FIXTURES.CLASSIC,
        expectations: [{ model: 'ClassicUser', field: 'testField', gen: 'generateClassic' }]
    },
    {
        name: 'multi-file schema in the default directory',
        targetPath: FIXTURES.MULTI,
        expectations: [{ model: 'MultiPost', field: 'title', gen: 'generateTitle' }]
    },
    {
        name: 'single schema file at a custom path',
        targetPath: FIXTURES.CUSTOM_SINGLE,
        expectations: [{ model: 'CustomModel', field: 'customField', gen: 'generateCustom' }]
    },
    {
        name: 'multi-file schema in a custom directory',
        targetPath: FIXTURES.CUSTOM_MULTI,
        expectations: [
            { model: 'CustomMultiUser', field: 'name', gen: 'generateMultiUser' },
            { model: 'BaseSession', field: 'token', gen: 'generateSessionToken' },
            { model: 'UserProfile', field: 'bio', gen: 'generateBio' }
        ]
    }
];

describe('CLI Parser Tests', () => {

    it.each(validTestCases)('should successfully parse a $name', async ({ targetPath, expectations }) => {
        runCliParser(targetPath);

        expect(fs.existsSync(generatedJsPath)).toBe(true);
        expect(fs.existsSync(generatedMjsPath)).toBe(true);
        expect(fs.existsSync(generatedDtsPath)).toBe(true);

        const jsContent = fs.readFileSync(generatedJsPath, 'utf-8');
        const dtsContent = fs.readFileSync(generatedDtsPath, 'utf-8');

        const jsonMatch = jsContent.match(/const rawConfig = (\{[\s\S]*?\});/);
        expect(jsonMatch).not.toBeNull();
        const jsDefaultsConfig = JSON.parse(jsonMatch![1]);
        
        expect(jsDefaultsConfig).toBeDefined();

        expectations.forEach(({ model, field, gen }) => {
            expect(jsDefaultsConfig.models[model]).toBeDefined();
            expect(jsDefaultsConfig.models[model][field]).toBe(gen);
            
            expect(dtsContent).toContain(`"${gen}"`);
        });
    });

    it('should throw an error when provided with a non-existent path', () => {
        expect(() => {
            runCliParser(FIXTURES.INVALID);
        }).toThrow();
    });

    it('should generate a config object without a prototype to prevent Prototype Pollution', () => {
        runCliParser(FIXTURES.CLASSIC);
        
        delete require.cache[require.resolve(generatedJsPath)];
        
        const { jsDefaultsConfig } = require(generatedJsPath);

        expect(Object.getPrototypeOf(jsDefaultsConfig.models)).toBeNull();
        expect(Object.getPrototypeOf(jsDefaultsConfig.relations)).toBeNull();

        expect(jsDefaultsConfig.models.__proto__).toBeUndefined();
    });

    afterAll(() => {
        runCliParser('./prisma/schema.prisma');
    });
});