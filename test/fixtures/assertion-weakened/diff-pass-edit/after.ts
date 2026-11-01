import { it, expect } from 'vitest';
import { slug } from '../src/slug';

it('slugs', () => {
  expect(slug('Hello World')).toEqual('hello-world');
  expect(slug('')).toBeDefined();
});
