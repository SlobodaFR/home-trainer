import { readFileSync } from 'fs';
import { join } from 'path';

describe('main.ts', () => {
  it('creates the app with rawBody: true (logout webhook signature)', () => {
    const source = readFileSync(join(__dirname, 'main.ts'), 'utf8');
    expect(source).toMatch(
      /NestFactory\.create<[^>]+>\(AppModule, \{[^}]*rawBody: true/s,
    );
  });
});
