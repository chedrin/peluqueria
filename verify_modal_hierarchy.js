const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('public/index.html', 'utf8');

const fiscalIdx = html.indexOf('id="aview-fiscal"');
const stockIdx = html.indexOf('id="aview-stock"');
const ticketModalIdx = html.indexOf('id="ticket-modal"');
const cardTerminalIdx = html.indexOf('id="modal-card-terminal"');

console.log('aview-fiscal index:', fiscalIdx);
console.log('aview-stock index:', stockIdx);
console.log('ticket-modal index:', ticketModalIdx);
console.log('modal-card-terminal index:', cardTerminalIdx);

assert(fiscalIdx !== -1, 'aview-fiscal debe existir');
assert(stockIdx !== -1, 'aview-stock debe existir');
assert(ticketModalIdx !== -1, 'ticket-modal debe existir');
assert(cardTerminalIdx !== -1, 'modal-card-terminal debe existir');

// 1. ticket-modal no debe estar entre fiscalIdx y stockIdx
assert(!(ticketModalIdx > fiscalIdx && ticketModalIdx < stockIdx), 'ticket-modal NO debe estar anidado en aview-fiscal');

// 2. ticket-modal debe estar ubicado junto a los modales globales independientes (antes de modal-card-terminal)
assert(ticketModalIdx < cardTerminalIdx, 'ticket-modal debe estar en la zona de modales globales antes de modal-card-terminal');

// 3. Verificar que ticket-modal tiene estilo z-index 9999
const modalSnippet = html.substring(ticketModalIdx - 20, ticketModalIdx + 200);
assert(modalSnippet.includes('z-[9999]') || modalSnippet.includes('z-index: 9999'), 'ticket-modal debe tener z-index alto');

console.log('✅ VERIFICACIÓN DE JERARQUÍA DOM: ticket-modal es un modal independiente global y visible sobre cualquier vista.');
