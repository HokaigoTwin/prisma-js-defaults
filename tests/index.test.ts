import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const generatedConfigPath = path.join(process.cwd(), 'prisma', 'js-defaults.json');

function runCliParser(schemaPath: string) {
    const cmd = `npx tsx src/index.ts --schema=${schemaPath}`;
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

    it.each(validTestCases)('should successfully parse a $name', ({ targetPath, expectations }) => {
        runCliParser(targetPath);
        
        expect(fs.existsSync(generatedConfigPath)).toBe(true);
        const config = JSON.parse(fs.readFileSync(generatedConfigPath, 'utf-8'));
        
        expectations.forEach(({ model, field, gen }) => {
            expect(config.models[model]).toBeDefined();
            expect(config.models[model][field]).toBe(gen);
        });
    });

    it('should throw an error when provided with a non-existent path', () => {
        expect(() => {
            runCliParser(FIXTURES.INVALID);
        }).toThrow();
    });

    afterAll(() => {
        runCliParser('./prisma/schema.prisma');
    });
});