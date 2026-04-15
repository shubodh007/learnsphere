const fs = require('fs');
let content = fs.readFileSync('supabase/functions/_shared/elite-prompt.ts', 'utf8');

// Replace the HUGE FULL_ELITE_PROMPT template literal with a series of single-quoted strings
// For simplicity and speed, I'll just replace the backticks with single quotes and handle lines
// This is specific to this file structure.

content = content.replace(/export const FULL_ELITE_PROMPT = `([\s\S]+?)`;/, (match, p1) => {
  const lines = p1.split('\n');
  const sanitizedLines = lines.map(line => {
    // Escape single quotes and backslashes
    let s = line.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return "'" + s + "\\n'";
  });
  return 'export const FULL_ELITE_PROMPT = \n' + sanitizedLines.join(' +\n') + ';';
});

// Also handle TEMPLATES which has backticks
content = content.replace(/`([\s\S]+?)`/g, (match, p1) => {
  // If it contains \${, it was already handled or is a function
  if (p1.includes('${')) return match; 
  return "'" + p1.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
});

fs.writeFileSync('supabase/functions/_shared/elite-prompt.ts', content);
console.log('Sanitized elite-prompt.ts');
