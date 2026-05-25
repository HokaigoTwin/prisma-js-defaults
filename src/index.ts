import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(process.cwd(), "prisma", "schema.extended.prisma");

console.log('Starting compile Prisma JS Defaults...');

try {
    const schemaText = fs.readFileSync(schemaPath, 'utf-8');

    const lines = schemaText.split('\n');

    let currentModel: string | null = null;

    const defaultJsConfig: Record<string, Record<string, string>> = {};

    const cleanLines: string[] = [];

    const defaultJsRegex = /@defaultJs\(([a-zA-Z0-9_]+)\)/;

    lines.forEach(line => {
        const modelMatch = line.match(/^model\s+([a-zA-Z0-9_]+)\s*\{/);
        if (modelMatch) {
            currentModel = modelMatch[1];
            defaultJsConfig[currentModel] = {};
        }

        const decoratorMatch = line.match(defaultJsRegex);
        if (decoratorMatch && currentModel) {
            const functionName = decoratorMatch[1];

            const fieldNameMatch = line.trim().match(/^([a-zA-Z0-9_]+)/);

            if (fieldNameMatch) {
                const fieldName = fieldNameMatch[1];

                defaultJsConfig[currentModel][fieldName] = functionName;

                line = line.replace(decoratorMatch[0], '');
            }
        }

        if (line.trim() === '}') {
            currentModel = null;
        }

        cleanLines.push(line);
    });

    const cleanSchemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    fs.writeFileSync(cleanSchemaPath, cleanLines.join('\n'), 'utf-8');

    const configPath = path.join(process.cwd(), "prisma", "js-defaults.json");
    fs.writeFileSync(configPath, JSON.stringify(defaultJsConfig, null, 2), 'utf-8');

    console.log('Files successfully saved to disk.');

    console.log('Running standard Prisma generator...');

    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('Prisma JS Defaults compilation completed successfully.');
} catch(e) {
    console.error("Error during compilation:", e);
}