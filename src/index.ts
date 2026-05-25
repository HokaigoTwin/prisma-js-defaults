#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

try {
    const schemaText = fs.readFileSync(schemaPath, 'utf-8');
    const lines = schemaText.split('\n');

    let currentModel: string | null = null;
    let pendingFunction: string | null = null;
    const defaultJsConfig: Record<string, Record<string, string>> = {};

    lines.forEach((line: string) => {
        const trimmedLine = line.trim();

        const modelMatch = trimmedLine.match(/^model\s+([a-zA-Z0-9_]+)\s*\{/);
        if (modelMatch) {
            currentModel = modelMatch[1];
            if (!defaultJsConfig[currentModel]) {
                defaultJsConfig[currentModel] = {};
            }
            return;
        }

        if (trimmedLine === '}') {
            currentModel = null;
            pendingFunction = null;
            return;
        }

        if (currentModel) {
            const decoratorMatch = trimmedLine.match(/\/\/\/\s*@defaultJs\(([a-zA-Z0-9_]+)\)/);
            if (decoratorMatch) {
                pendingFunction = decoratorMatch[1];
                return;
            }

            if (pendingFunction && trimmedLine.length > 0 && !trimmedLine.startsWith('///')) {
                const fieldMatch = trimmedLine.match(/^([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_]+/);
                if (fieldMatch) {
                    const fieldName = fieldMatch[1];
                    if (currentModel) {
                        defaultJsConfig[currentModel][fieldName] = pendingFunction;
                    }
                    pendingFunction = null;
                }
            }
        }
    });

    const configPath = path.join(process.cwd(), "prisma", "js-defaults.json");
    fs.writeFileSync(configPath, JSON.stringify(defaultJsConfig, null, 2), 'utf-8');

    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('[prisma-js-defaults] INFO: Successfully applied.');

} catch(e) {
    console.error("[prisma-js-defaults] ERROR:", e);
    process.exit(1);
}