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
fs.writeFileSync('final-payload.json', JSON.stringify(result, null, 2));
console.log('Final payload written to final-payload.json');
