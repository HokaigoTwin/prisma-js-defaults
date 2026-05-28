#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getDMMF } from '@prisma/internals';

function getAllPrismaFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'migrations' && file !== 'node_modules') {
                getAllPrismaFiles(fullPath, arrayOfFiles);
            }
        } else if (file.endsWith('.prisma')) {
            arrayOfFiles.push(fullPath);
        }
    }

    return arrayOfFiles;
}

async function main() {
    let schemaText = "";
    let customSchemaPath: string | undefined;
    let skipGenerate = false;

    for (let i = 0; i < process.argv.length; i++) {
        if (process.argv[i] === '--schema' && process.argv[i + 1]) {
            customSchemaPath = process.argv[i + 1];
            break;
        } else if (process.argv[i].startsWith('--schema=')) {
            customSchemaPath = process.argv[i].split('=')[1];
            break;
        } else if(process.argv[i] === '--skip-generate') {
            skipGenerate = true;
        }
    }
    
    const targetPath = customSchemaPath ? path.resolve(process.cwd(), customSchemaPath) : path.join(process.cwd(), "prisma");

    try {
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Path does not exist: ${targetPath}\nPlease check your --schema argument or ensure the 'prisma' directory exists.`);
        }

        const stat = fs.statSync(targetPath);

        if (stat.isDirectory()) {
            const prismaFiles = getAllPrismaFiles(targetPath);
            
            if (prismaFiles.length === 0) {
                throw new Error(`Could not find any .prisma files in directory: ${targetPath}`);
            }

            console.log(`[prisma-js-defaults] INFO: Detected ${prismaFiles.length} .prisma file(s) in ${targetPath}. Merging...`);
            schemaText = prismaFiles.map(file => fs.readFileSync(file, 'utf-8')).join('\n');
        } 
        else if (stat.isFile() && targetPath.endsWith('.prisma')) {
            console.log(`[prisma-js-defaults] INFO: Reading single schema file: ${targetPath}`);
            schemaText = fs.readFileSync(targetPath, 'utf-8');
        } else {
            throw new Error(`Invalid schema path provided: ${targetPath}`);
        }

        const dmmf = await getDMMF({ datamodel: schemaText });

        const config = {
            models: {} as Record<string, Record<string, string>>,
            relations: {} as Record<string, Record<string, string>>
        };

        const functionNames = new Set<string>();

        dmmf.datamodel.models.forEach((model) => {
            const modelName = model.name;

            model.fields.forEach((field) => {
                if (field.documentation && field.documentation.includes('@defaultJs(')) {
                    const match = field.documentation.match(/@defaultJs\(([a-zA-Z0-9_]+)\)/);
                    if (match) {
                        if (!config.models[modelName]) config.models[modelName] = {};
                        config.models[modelName][field.name] = match[1];

                        functionNames.add(match[1]);
                    }
                }

                if (field.kind === 'object') {
                    if (!config.relations[modelName]) config.relations[modelName] = {};
                    config.relations[modelName][field.name] = field.type; 
                }
            });
        });

        const configDir = path.join(process.cwd(), "prisma", "generated", "js-defaults");
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const configJson = JSON.stringify(config, null, 2);

        const jsPath = path.join(configDir, "index.js");
        const jsContent = `
const rawConfig = ${configJson};

const jsDefaultsConfig = {
    models: Object.assign(Object.create(null), rawConfig.models),
    relations: Object.assign(Object.create(null), rawConfig.relations)
};

module.exports = { jsDefaultsConfig };
        `;

        fs.writeFileSync(jsPath, jsContent, 'utf-8');

        const funcUnion = functionNames.size > 0 ? Array.from(functionNames).map(name => `"${name}"`).join(" | ") : "string";

        const dtsPath = path.join(configDir, "index.d.ts");
        const dtsContent = `
export interface ConfigFormat {
    models: Record<string, Record<string, string>>;
    relations: Record<string, Record<string, string>>;
}

export type TypedConfig<T extends string> = ConfigFormat & { _phantom?: T };
            
export type RequiredFunctions = ${funcUnion};
            
export declare const jsDefaultsConfig: TypedConfig<RequiredFunctions>;
        `;

        fs.writeFileSync(dtsPath, dtsContent, 'utf-8');

        if (!skipGenerate) {
            const prismaCommand = customSchemaPath ? `npx prisma generate --schema="${customSchemaPath}"` : 'npx prisma generate';
            execSync(prismaCommand, { stdio: 'inherit' });
        }
        
        console.log('[prisma-js-defaults] INFO: Successfully applied DMMF parser and generated relations.');
    } catch(e) {
        console.error("[prisma-js-defaults] ERROR:", e);
        process.exit(1);
    }
}

main();