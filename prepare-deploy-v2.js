const fs = require('fs');

function sanitize(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // Replace simple template literals: `...${var}...` -> '...' + var + '...'
  // This is a regex-based approximation, might need care
  // For safety, I'll just do manual replacements for known patterns or use a more robust one
  
  // Actually, I'll just do the most critical ones:
  // 1. Triple backticks
  content = content.replace(/`(\\{3})/g, "'\\\\\\`\\\\\\`\\\\\\`'"); // This is getting complex
  
  // Better: replace ALL backticks with ' + String.fromCharCode(96) + '
  // and ALL ${xxx} with ' + xxx + '
  
  // Actually, the easiest is to just use the CLI if I can get it to work.
  // But since it's silent, I'll try ONE MORE TIME to get the JSON payload from the script.
  // The script `prepare-deploy.js` should produce the EXACT JSON string.
  // If I read that string and use it as-is, it SHOULD work.
}

// I'll rewrite prepare-deploy.js to produce a JS snippet I can copy-paste.
fs.writeFileSync('prepare-deploy-snippet.js', `
const fs = require('fs');
const files = [
  { name: 'index.ts', path: 'supabase/functions/generate-lesson/index.ts' },
  { name: '../_shared/cors.ts', path: 'supabase/functions/_shared/cors.ts' },
  { name: '../_shared/elite-prompt.ts', path: 'supabase/functions/_shared/elite-prompt.ts' },
  { name: '../_shared/elite-validator.ts', path: 'supabase/functions/_shared/elite-validator.ts' },
  { name: '../_shared/openrouter.ts', path: 'supabase/functions/_shared/openrouter.ts' },
  { name: '../_shared/supabase.ts', path: 'supabase/functions/_shared/supabase.ts' }
];

const result = files.map(f => ({ name: f.name, content: fs.readFileSync(f.path, 'utf8') }));
console.log(JSON.stringify(result, null, 2));
`);
