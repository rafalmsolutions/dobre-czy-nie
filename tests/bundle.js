// Składa pliki aplikacji w jeden moduł dla testów w Node.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const strip = s => s.replace(/if \(typeof module !== 'undefined'[^\n]*module\.exports = (Game|Shelf);\n?/, '');
const src = ['data.js', 'core.js', 'game.js', 'shelf.js'].map(f => strip(fs.readFileSync(path.join(dir, f), 'utf8'))).join('\n')
  + '\nmodule.exports = Object.assign(module.exports, { Game, Shelf, GOALS, GOAL_TILES, DEPARTMENTS, HOME_TILES, PROFILE_OPTIONS });\n';
fs.writeFileSync(path.join(__dirname, 'bundle.cjs'), src);
const cfg = n => JSON.parse(fs.readFileSync(path.join(dir, 'config', n + '.json'), 'utf8'));
module.exports = { A: require('./bundle.cjs'), CFG: { rules: cfg('points-rules'), levels: cfg('levels'), achievements: cfg('achievements'), challenges: cfg('weekly-challenges') } };
