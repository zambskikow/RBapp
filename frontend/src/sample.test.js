import { describe, it, expect } from 'vitest';

describe('Sample Test', () => {
    it('should be true', () => {
        expect(true).toBe(true);
    });

    it('should format a basic string', () => {
        const name = 'FiscalApp';
        expect(`Hello ${name}`).toBe('Hello FiscalApp');
    });
});
