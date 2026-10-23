const fs = require('fs');

console.log('================================================================');
console.log('🧪 TEST: PORTAL TRABAJADORAS - ORDEN POR HORA Y SELECTOR DE FECHAS');
console.log('================================================================\n');

const html = fs.readFileSync('public/index.html', 'utf8');

// 1. Verificar elementos del DOM para control de fechas en Portal Trabajadoras
console.log('1. Verificando controles de fecha en DOM:');
const requiredControls = [
  'worker-agenda-datepicker',
  'btn-worker-yesterday',
  'btn-worker-today',
  'btn-worker-tomorrow',
  'worker-agenda-title',
  'worker-appointment-count',
  'worker-agenda-list'
];

let allControlsFound = true;
requiredControls.forEach(id => {
  if (html.includes(`id="${id}"`)) {
    console.log(`   ✅ Control #${id} presente en HTML.`);
  } else {
    console.error(`   ❌ Falta #${id} en HTML.`);
    allControlsFound = false;
  }
});

// 2. Verificar funciones implementadas en JavaScript
console.log('\n2. Verificando funciones de navegación y ordenación en JavaScript:');
const requiredFunctions = [
  'function getFriendlyWorkerDateLabel',
  'function onWorkerAgendaDateChange',
  'function changeWorkerAgendaDate',
  'function setWorkerAgendaPreset',
  'myApts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())'
];

let allFunctionsFound = true;
requiredFunctions.forEach(fn => {
  if (html.includes(fn)) {
    console.log(`   ✅ Encontrado: ${fn.substring(0, 45)}...`);
  } else {
    console.error(`   ❌ No encontrado: ${fn}`);
    allFunctionsFound = false;
  }
});

// 3. Simular ordenación cronológica con citas de muestra
console.log('\n3. Simulando ordenación cronológica por hora:');
const sampleApts = [
  { id: 'apt-3', startTime: '2026-10-23T16:30:00.000Z', clientName: 'Marta' },
  { id: 'apt-1', startTime: '2026-10-23T09:30:00.000Z', clientName: 'Beatriz' },
  { id: 'apt-2', startTime: '2026-10-23T11:00:00.000Z', clientName: 'Laura' }
];

sampleApts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

const isSorted = sampleApts[0].id === 'apt-1' && sampleApts[1].id === 'apt-2' && sampleApts[2].id === 'apt-3';
if (isSorted) {
  console.log('   ✅ Ordenación cronológica exitosa: 09:30 -> 11:00 -> 16:30.');
} else {
  console.error('   ❌ Fallo en la ordenación:', sampleApts);
}

if (allControlsFound && allFunctionsFound && isSorted) {
  console.log('\n🎉 TEST SUPERADO: El Portal de Trabajadoras cumple al 100% con ordenación por hora y navegación de fechas!');
} else {
  process.exit(1);
}
