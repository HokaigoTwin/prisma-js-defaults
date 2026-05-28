import { Prisma } from '@prisma/client';
import { deepClone } from './utils/deepClone';

export interface ConfigFormat {
    models: Record<string, Record<string, string>>;
    relations: Record<string, Record<string, string>>;
}

export type TypedConfig<T extends string> = ConfigFormat & { _phantom?: T };

export const withJsDefaults = <T extends string>(config: TypedConfig<T>, functions: Record<T, (data?: any) => any>) => {
        const applyDefaultsToObj = async(model: string, dataObj: any, isUpdatePayload: boolean = false): Promise<any> => {
        if(!dataObj || typeof dataObj !== 'object') return dataObj;

        const modelConfig = config.models[model];
        const modelRelations = config.relations[model];

        if (modelConfig && !isUpdatePayload) {
            const defaultPromises = Object.entries(modelConfig).map(async ([field, funcName]) => {
                if (dataObj[field] === undefined) {
                    const generatorFn = functions[funcName as T];
                    if (generatorFn) {
                        try{
                            dataObj[field] = await generatorFn(dataObj);
                        } catch(error: any){
                            throw new Error(`\n[prisma-js-defaults] Error executing your function "${funcName}" for field "${field}" on model "${model}".\nError details: ${error.message}`);                        
                        }
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
                    relationData.create = await applyDefaultsToObj(targetModel, relationData.create, false);
                }

                if (relationData.create && Array.isArray(relationData.create)) {
                    relationData.create = await Promise.all(
                        relationData.create.map((item: any) => applyDefaultsToObj(targetModel, item, false))
                    );
                }

                if (relationData.createMany?.data && Array.isArray(relationData.createMany.data)) {
                    relationData.createMany.data = await Promise.all(
                        relationData.createMany.data.map((item: any) => applyDefaultsToObj(targetModel, item, false))
                    );
                }

                if (relationData.upsert) {
                    const upserts = Array.isArray(relationData.upsert) ? relationData.upsert : [relationData.upsert];
                    await Promise.all(upserts.map(async (u: any) => {
                        if (u.create) u.create = await applyDefaultsToObj(targetModel, u.create, false);
                        if (u.update){
                            const targetData = u.update.data ? u.update.data : u.update;
                            await applyDefaultsToObj(targetModel, targetData, true);
                        }
                    }));
                }

                if (relationData.connectOrCreate) {
                    const connects = Array.isArray(relationData.connectOrCreate) ? relationData.connectOrCreate : [relationData.connectOrCreate];
                    await Promise.all(connects.map(async (c: any) => {
                        if (c.create) c.create = await applyDefaultsToObj(targetModel, c.create, false);
                    }));
                }

                if(relationData.update){
                    const updates = Array.isArray(relationData.update) ? relationData.update : [relationData.update];
                    await Promise.all(updates.map(async (u: any) => {
                        const targetData = u.data ? u.data : u;
                        await applyDefaultsToObj(targetModel, targetData, true);
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
                    const safeArgs = deepClone(args);
                    if (safeArgs?.data) {
                        safeArgs.data = await applyDefaultsToObj(model, safeArgs.data, false);
                    }
                    return query(safeArgs);
                },

                async createMany({ model, args, query }){
                    const safeArgs = deepClone(args);
                    await applyDefaultsToArray(model, safeArgs);
                    return query(safeArgs);
                },

                async createManyAndReturn({model, args, query}){
                    const safeArgs = deepClone(args);
                    await applyDefaultsToArray(model, safeArgs);
                    return query(safeArgs);
                },

                async upsert({model, args, query}){
                    const safeArgs = deepClone(args);
                    if(safeArgs?.create){
                        safeArgs.create = await applyDefaultsToObj(model, safeArgs.create, false);
                    }
                    if(safeArgs?.update){
                        safeArgs.update = await applyDefaultsToObj(model, safeArgs.update, true);
                    }
                    return query(safeArgs);
                },

                async update({model, args, query}){
                    const safeArgs = deepClone(args);
                    if(safeArgs?.data){
                        safeArgs.data = await applyDefaultsToObj(model, safeArgs.data, true);
                    }
                    return query(safeArgs);
                }
            }
        }
    });
};