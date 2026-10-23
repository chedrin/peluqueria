const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

// Extract script contents
const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIdx = 0;
let errors = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  scriptIdx++;
  const scriptContent = match[1];
  console.log(`Checking inline script #${scriptIdx} (length: ${scriptContent.length} chars)...`);
  try {
    new Function(scriptContent);
    console.log(`✅ Script #${scriptIdx} syntax is 100% valid JavaScript!`);
  } catch (err) {
    console.error(`❌ Syntax error in script #${scriptIdx}:`, err.message);
    errors++;
  }
}

if (errors === 0) {
  console.log('🎉 ALL INLINE SCRIPTS ARE 100% VALID JAVASCRIPT!');
} else {
  console.error(`Found ${errors} script error(s)`);
  process.exit(1);
}
