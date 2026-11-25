import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Lance le vrai entrypoint.sh avec un `node` factice : le seed (premier appel) échoue, l'app doit démarrer.
describe('entrypoint.sh', () => {
  it('starts the app even when the seed fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ep-'));
    const log = join(dir, 'calls.log');
    const fakeNode = join(dir, 'node');
    writeFileSync(
      fakeNode,
      `#!/bin/sh\necho "$1" >> "${log}"\ncase "$1" in *wger-seed*) exit 1;; esac\nexit 0\n`,
    );
    chmodSync(fakeNode, 0o755);
    const r = spawnSync('sh', [resolve(__dirname, '../../entrypoint.sh')], {
      env: { PATH: `${dir}:/usr/bin:/bin` },
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/WARNING: exercise seed failed/);
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      'dist/seed/wger-seed.js',
      'dist/main.js',
    ]);
  });
});
