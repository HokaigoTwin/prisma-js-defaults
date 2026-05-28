import { describe, it, expect } from 'vitest';
import { deepClone } from '../src/utils/deepClone';

describe('deepClone Utility', () => {

    it('should clone primitive values and null without changes', () => {
        expect(deepClone(null)).toBeNull();
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(true)).toBe(true);
    });

    it('should deeply clone standard objects and arrays', () => {
        const original = { a: 1, b: [2, 3, { c: 4 }] };
        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b); 
        expect((cloned.b[2] as any).c).toBe(4);
    });

    it('should clone Date objects', () => {
        const originalDate = new Date('2026-01-01');
        const clonedDate = deepClone(originalDate);

        expect(clonedDate.getTime()).toBe(originalDate.getTime());
        expect(clonedDate).not.toBe(originalDate);
    });

    it('should clone Buffer objects', () => {
        const originalBuffer = Buffer.from('hello world');
        const clonedBuffer = deepClone(originalBuffer);

        expect(clonedBuffer.toString()).toBe('hello world');
        expect(clonedBuffer).not.toBe(originalBuffer);
        expect(Buffer.isBuffer(clonedBuffer)).toBe(true);
    });

    it('should clone Prisma.Decimal objects using duck typing', () => {
        class MockDecimal {
            d = [1, 2, 3];
            e = 1;
            s = 1;
            constructor(public val: any) {}
            toNumber() { return 123; }
        }

        const originalDecimal = new MockDecimal("100.5");
        const clonedDecimal = deepClone(originalDecimal);

        expect(clonedDecimal).toBeInstanceOf(MockDecimal);
        expect(clonedDecimal).not.toBe(originalDecimal);
        expect(clonedDecimal.val).toBe(originalDecimal); 
    });

    it('should reject fake Decimal objects and clone them as standard objects', () => {
        const fakeDecimal = {
            d: [1, 2, 3],
            e: 1,
            s: 1,
            toNumber: () => 123
        };

        const clonedFake = deepClone(fakeDecimal);

        expect(clonedFake).toEqual(fakeDecimal);
        expect(clonedFake).not.toBe(fakeDecimal);
        expect(clonedFake.toNumber()).toBe(123);
    });

    it('should safely handle Circular References without throwing Stack Overflow', () => {
        const circularObj: any = { name: "John" };
        circularObj.myself = circularObj; 

        const clonedCircular = deepClone(circularObj);

        expect(clonedCircular.name).toBe("John");
        expect(clonedCircular.myself).toBe(clonedCircular); 
        expect(clonedCircular).not.toBe(circularObj);
    });
});