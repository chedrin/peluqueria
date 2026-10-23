const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, res => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(data) }));
    }).on('error', reject);
  });
}

async function testAll() {
  console.log('--- Testing Backend Endpoints ---');

  // 1. Users with passwords
  const uRes = await get('/api/auth/users');
  const users = JSON.parse(uRes.body.toString());
  console.log('1. Users count:', users.length, 'sample user:', users[0].displayName, 'password present:', !!users[0].password);

  // 2. Loyalty excel export
  const loyRes = await get('/api/loyalty/export-excel');
  console.log('2. Loyalty excel size:', loyRes.body.length, 'status:', loyRes.status);

  // 3. Complete and notify
  const compRes = await new Promise((res, rej) => {
    const req = http.request('http://localhost:3000/api/appointments/apt-elena-1/complete-and-notify', { method: 'POST' }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, data: JSON.parse(d) }));
    });
    req.end();
  });
  console.log('3. Complete & notify:', compRes.status, compRes.data.message);

  // 4. Notifications
  const notifRes = await get('/api/notifications');
  const notifs = JSON.parse(notifRes.body.toString());
  console.log('4. Notifications count:', notifs.length, 'latest:', notifs[0].title);

  // 5. Schedule slots
  const slotRes = await get('/api/staff/stf-1/schedule-slots');
  const slots = JSON.parse(slotRes.body.toString());
  console.log('5. Elena schedule slots count:', slots.slots.length, 'disabled count:', slots.disabledSlots.length);

  // 6. VIP loyalty details
  const vipRes = await get('/api/clients/cli-1/loyalty-details');
  const vip = JSON.parse(vipRes.body.toString());
  console.log('6. VIP details for Laura:', vip.client.name, 'stamps:', vip.stampsCount, 'history count:', vip.stampHistory.length);
}

testAll().catch(console.error);
