// Buduje projekt Androida (Trusted Web Activity) z android/twa-manifest.json narzędziem @bubblewrap/core.
// Uruchamiane w GitHub Actions (.github/workflows/android.yml). Wersja = appVersion z app/config.js, kod wersji = numer przebiegu + 100.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(path.resolve('android/package.json'));
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');
const out = path.resolve(process.argv[2] || 'twa');
const json = JSON.parse(fs.readFileSync('android/twa-manifest.json', 'utf8'));
const ver = (fs.readFileSync('app/config.js', 'utf8').match(/appVersion:\s*'([^']+)'/) || [])[1] || json.appVersionName;
json.appVersionName = ver;
json.appVersionCode = 100 + Number(process.env.GITHUB_RUN_NUMBER || 0);
console.log(`Lupka ${ver} (kod wersji ${json.appVersionCode}) → ${out}`);
fs.mkdirSync(out, { recursive: true });
const manifest = new TwaManifest(json);
const log = new ConsoleLog('twa');
await new TwaGenerator().createTwaProject(out, manifest, log);
fs.writeFileSync(path.join(out, 'twa-manifest.json'), JSON.stringify(json, null, 2));
console.log('Projekt gotowy.');
