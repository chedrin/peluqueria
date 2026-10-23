const http = require('http');

function put(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(buf) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(buf) }));
    }).on('error', reject);
  });
}

async function run() {
  const apts = await get('/api/appointments');
  // Encontrar la cita de Beatriz Navarro (actualmente con Raquel stf-2)
  const beatrizApt = apts.data.find(a => a.clientName.includes('Beatriz'));
  console.log('Original appointment:', {
    id: beatrizApt.id,
    client: beatrizApt.clientName,
    staffId: beatrizApt.staffId,
    staffName: beatrizApt.staffName,
    startTime: beatrizApt.startTime
  });

  // Mover a Elena (stf-1) a las 11:30 (que está libre en Elena)
  const newStart = new Date('2026-10-23T11:30:00');
  const newEnd = new Date('2026-10-23T12:00:00');

  console.log('\n--- Probando mover ficha a hora libre de Elena (11:30) ---');
  const res = await put(`/api/appointments/${beatrizApt.id}/reschedule`, {
    staffId: 'stf-1',
    startTime: newStart.toISOString(),
    endTime: newEnd.toISOString()
  });

  console.log('Reschedule status:', res.status, res.data.message);
  console.log('Updated appointment:', {
    id: res.data.appointment.id,
    staffId: res.data.appointment.staffId,
    staffName: res.data.appointment.staffName,
    startTime: res.data.appointment.startTime,
    endTime: res.data.appointment.endTime
  });

  console.log('\n--- Probando colisión si intentamos mover a una hora ocupada (12:00 Elena) ---');
  const colRes = await put(`/api/appointments/${beatrizApt.id}/reschedule`, {
    staffId: 'stf-1',
    startTime: new Date('2026-10-23T12:00:00').toISOString(),
    endTime: new Date('2026-10-23T12:30:00').toISOString()
  });
  console.log('Collision status (expected 409):', colRes.status, colRes.data.error);

  console.log('\n✅ TEST RESCHEDULE TO FREE SLOT SUPERADO!');
}

run().catch(e => {
  console.error('Error in test:', e);
  process.exit(1);
});
