import { Prisma } from '@prisma/client';

export const deepClone = <T>(obj: T, seen = new WeakMap()): T => {
    if (obj === null || typeof obj !== "object") return obj;
    if (seen.has(obj as object)) return seen.get(obj as object);

    if (obj instanceof Date) return new Date(obj.getTime()) as any;

    if (typeof Buffer !== "undefined" && Buffer.isBuffer(obj)) {
        return Buffer.from(obj) as any;
    }

    if (
        (Prisma.DbNull && (obj as any) === Prisma.DbNull) ||
        (Prisma.JsonNull && (obj as any) === Prisma.JsonNull) ||
        (Prisma.AnyNull && (obj as any) === Prisma.AnyNull)
    ) {
        return obj; 
    }

    if (
        obj.constructor &&
        obj.constructor.name !== 'Object' &&
        typeof (obj as any).toNumber === 'function' &&
        'd' in obj && 'e' in obj && 's' in obj
    ) {
        return new (obj.constructor as any)(obj);
    }

    const clonedObj = (Array.isArray(obj) ? [] : {}) as any;
    
    seen.set(obj as object, clonedObj);

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clonedObj[key] = deepClone(obj[key], seen);
        }
    }
    
    return clonedObj;
}