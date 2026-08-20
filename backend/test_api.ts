async function run() {
  const res = await fetch('http://localhost:3001/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'test_hero', phone: '555-1234567' })
  });
  const data = await res.json();
  console.log('API Response:', data);
}
run();
