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

    const applyDefaultsToObj = async(model: string, dataObj: any) => {
        if(!dataObj || typeof dataObj !== 'object') return dataObj;

        const modelConfig = defaultJsConfig[model];
        if(!modelConfig) return dataObj;

        for(const [field, funcName] of Object.entries(modelConfig)) {
            if(dataObj[field] === undefined){
                const generatorFn = functions[funcName];

                if(generatorFn){
                    // @ts-ignore
                    dataObj[field] = await generatorFn();
                } else {
                    console.warn(`[prisma-js-defaults] WARN: Function "${funcName}" was not provided for field "${field}" on model "${model}".`);
                }

            }
        }

        return dataObj;
    }

    const applyDefaultsToArray = async(model: string, args: any){
        if(args?.data && Array.isArray(args.data)){
            args.data = await Promise.all(
                args.data.map((item: any)=> applyDefaultsToObj(model, item))
            )
        }
    
        return args;
    }

    return Prisma.defineExtension({
        name: 'prisma-js-defaults',
        query: {
            $allModels: {
                async create({ model, args, query }) {
                    if (args?.data) {
                        args.data = await applyDefaultsToObj(model, args.data);
                    }
                    return query(args);
                },

                async createManyAndReturn({ model, args, query }){
                    args = await applyDefaultsToArray(model, args);
                    return query(args);
                },

                async createManyAndReturn({model, args, query}){
                    args = await applyDefaultsToArray(model, args);
                    return query(args);
                },

                async upsert({model, args, query}){
                    if(args?.create){
                        args.create = await applyDefaultsToObj(model, args.create);
                    }
                    return query(args);
                }
            }
        }
    });
};