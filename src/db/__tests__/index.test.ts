import { describe, it, expect } from 'vitest';
import { db } from '../index';

describe('Database module', () => {
  it('should export db instance', () => {
    expect(db).toBeDefined();
    expect(typeof db).toBe('object');
  });

  it('should have drizzle orm methods', () => {
    expect(db).toBeTruthy();
    expect(db).toHaveProperty('select');
    expect(db).toHaveProperty('insert');
    expect(db).toHaveProperty('update');
    expect(db).toHaveProperty('delete');
  });
});
