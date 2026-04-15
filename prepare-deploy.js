const fs = require('fs');
const files = [
  { name: 'index.ts', path: 'supabase/functions/generate-lesson/index.ts' },
  { name: '../_shared/cors.ts', path: 'supabase/functions/_shared/cors.ts' },
  { name: '../_shared/elite-prompt.ts', path: 'supabase/functions/_shared/elite-prompt.ts' },
  { name: '../_shared/elite-validator.ts', path: 'supabase/functions/_shared/elite-validator.ts' },
  { name: '../_shared/openrouter.ts', path: 'supabase/functions/_shared/openrouter.ts' },
  { name: '../_shared/supabase.ts', path: 'supabase/functions/_shared/supabase.ts' }
];

const result = files.map(f => {
  try {
    return { name: f.name, content: fs.readFileSync(f.path, 'utf8') };
  } catch (err) {
    console.error(`Failed to read ${f.path}:`, err.message);
    process.exit(1);
  }
});

fs.writeFileSync('deploy-payload.json', JSON.stringify(result));
console.log('Payload written to deploy-payload.json');
