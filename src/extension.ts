import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(process.cwd(), 'prisma', 'js-defaults.json');
let defaultJsConfig: Record<string, Record<string, string>> = {};

try {
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    defaultJsConfig = JSON.parse(rawConfig);
} catch (e) {
    console.warn('[prisma-js-defaults] WARN: js-defaults.json not found. Did you run `npx prisma-js-defaults`?');
}

export const withJsDefaults = (functions: Record<string, () => any>) => {
    return Prisma.defineExtension({
        name: 'prisma-js-defaults',
        query: {
            $allModels: {
                async create({ model, args, query }) {
                    const modelConfig = defaultJsConfig[model];

                    if (modelConfig && args.data) {
                        for (const [field, funcName] of Object.entries(modelConfig)) {
                            
                            if (args.data[field as keyof typeof args.data] === undefined) {
                                const generatorFn = functions[funcName];

                                if (generatorFn) {
                                    // @ts-ignore
                                    args.data[field] = await generatorFn();
                                } else {
                                    console.warn(`[prisma-js-defaults] WARN: Function "${funcName}" was not provided for field "${field}" on model "${model}".`);
                                }
                            }
                        }
                    }

                    return query(args);
                }
            }
        }
    });
};