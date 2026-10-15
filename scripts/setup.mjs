import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) {
  console.log('.env already exists; preserved it.');
} else {
  const env = readFileSync('.env.example', 'utf8')
    .replace('replace-with-random-at-least-32-character-secret', randomBytes(48).toString('hex'))
    .replace(
      'replace-with-a-different-random-32-character-secret',
      randomBytes(48).toString('hex'),
    );
  writeFileSync('.env', env, { mode: 0o600 });
  console.log('Created local .env with random JWT secrets. No credentials were printed.');
}
