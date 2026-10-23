const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

console.log('HTML size:', html.length, 'bytes');

// Check script blocks for syntax errors
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIdx = 0;
let errors = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  scriptIdx++;
  const scriptContent = match[1];
  if (!scriptContent.trim()) continue;
  try {
    new Function(scriptContent);
    console.log(`Script block #${scriptIdx} syntax OK (${scriptContent.length} chars)`);
  } catch (err) {
    console.error(`Syntax Error in script block #${scriptIdx}:`, err.message);
    errors++;
  }
}

// Check key IDs
const requiredIds = [
  'aview-agenda',
  'master-agenda-datepicker',
  'btn-filter-agenda-all',
  'btn-filter-agenda-free',
  'btn-filter-agenda-busy',
  'agenda-col-elena',
  'agenda-col-raquel',
  'agenda-col-carmen',
  'stats-busy-elena',
  'stats-free-elena',
  'stats-busy-raquel',
  'stats-free-raquel',
  'stats-busy-carmen',
  'stats-free-carmen',
  'aview-packages',
  'admin-client-packages-tbody',
  'modal-custom-package-assign',
  'modal-client-package-card',
  'modal-package-redeem-prompt',
  'modal-package-redeem-success',
  'c360-packages-container'
];

requiredIds.forEach(id => {
  if (html.includes(`id="${id}"`)) {
    console.log(`✅ ID "${id}" present in DOM`);
  } else {
    console.error(`❌ ID "${id}" MISSING in DOM`);
    errors++;
  }
});

if (errors === 0) {
  console.log('\n🎉 ALL SYNTAX AND DOM VALIDATIONS PASSED!');
} else {
  console.error(`\n❌ FAILED with ${errors} errors.`);
  process.exit(1);
}
