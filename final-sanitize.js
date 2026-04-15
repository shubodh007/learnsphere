const fs = require('fs');

function sanitizeFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // Replace all ${xxx} with ' + xxx + '
  // We need to be careful with nested ones, but these files are simple
  content = content.replace(/\${([\s\S]+?)}/g, "' + ($1) + '");
  
  // Replace all backticks with single quotes
  // We need to escape existing single quotes first
  content = content.replace(/'/g, "\\'");
  content = content.replace(/`/g, "'");
  
  // Clean up ' + + ' situations that might arise from empty segments
  content = content.replace(/' \+ \+ '/g, " + ");
  
  fs.writeFileSync(path, content);
  console.log(`Sanitized ${path}`);
}

const files = [
  'supabase/functions/generate-lesson/index.ts',
  'supabase/functions/_shared/elite-prompt.ts',
  'supabase/functions/_shared/openrouter.ts',
  'supabase/functions/chat/index.ts'
];

files.forEach(f => {
  try {
    sanitizeFile(f);
  } catch (err) {
    console.error(`Failed to sanitize ${f}:`, err.message);
  }
});
