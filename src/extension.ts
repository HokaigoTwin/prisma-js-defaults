import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface ConfigFormat {
    models: Record<string, Record<string, string>>;
    relations: Record<string, Record<string, string>>;
}

const configPath = path.join(process.cwd(), 'prisma', 'js-defaults.json');

let defaultJsConfig: ConfigFormat = {
    models: {},
    relations: {},
}

try {
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    defaultJsConfig = JSON.parse(rawConfig);
} catch (e) {
    console.warn('[prisma-js-defaults] WARN: js-defaults.json not found. Did you run `npx prisma-js-defaults`?');
}

export const withJsDefaults = (functions: Record<string, () => any>) => {
    const applyDefaultsToObj = async(model: string, dataObj: any): Promise<any> => {
        if(!dataObj || typeof dataObj !== 'object') return dataObj;

        const modelConfig = defaultJsConfig.models[model];
        const modelRelations = defaultJsConfig.relations[model];

        if (modelConfig) {
            const defaultPromises = Object.entries(modelConfig).map(async ([field, funcName]) => {
                if (dataObj[field] === undefined) {
                    const generatorFn = functions[funcName];
                    if (generatorFn) {
                        dataObj[field] = await generatorFn();
                    } else {
                        console.warn(`[prisma-js-defaults] WARN: Function "${funcName}" was not provided for field "${field}" on model "${model}".`);
                    }
                }
            });

            await Promise.all(defaultPromises);
        }

        if (modelRelations) {
            const relationPromises = Object.entries(modelRelations).map(async ([field, targetModel]) => {
                const relationData = dataObj[field]; 
                if (!relationData) return;

                if (relationData.create && !Array.isArray(relationData.create)) {
                    relationData.create = await applyDefaultsToObj(targetModel, relationData.create);
                }

                if (relationData.create && Array.isArray(relationData.create)) {
                    relationData.create = await Promise.all(
                        relationData.create.map((item: any) => applyDefaultsToObj(targetModel, item))
                    );
                }

                if (relationData.createMany?.data && Array.isArray(relationData.createMany.data)) {
                    relationData.createMany.data = await Promise.all(
                        relationData.createMany.data.map((item: any) => applyDefaultsToObj(targetModel, item))
                    );
                }

                if (relationData.upsert) {
                    const upserts = Array.isArray(relationData.upsert) ? relationData.upsert : [relationData.upsert];
                    await Promise.all(upserts.map(async (u: any) => {
                        if (u.create) u.create = await applyDefaultsToObj(targetModel, u.create);
                    }));
                }

                if (relationData.connectOrCreate) {
                    const connects = Array.isArray(relationData.connectOrCreate) ? relationData.connectOrCreate : [relationData.connectOrCreate];
                    await Promise.all(connects.map(async (c: any) => {
                        if (c.create) c.create = await applyDefaultsToObj(targetModel, c.create);
                    }));
                }
            });

            await Promise.all(relationPromises);
        }

        return dataObj;
    }

    const applyDefaultsToArray = async(model: string, args: any): Promise<any> => {
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

                async createMany({ model, args, query }){
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