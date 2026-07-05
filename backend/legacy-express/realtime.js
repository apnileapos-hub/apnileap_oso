let clients = [];

// Register real-time client via Server-Sent Events
function handleRealtimeConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  console.log(`📡 Real-time Client Connected: ${clientId}. Total clients: ${clients.length}`);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'PING', message: 'Connected to APNILEAP Realtime' })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
    console.log(`📡 Real-time Client Disconnected: ${clientId}. Total clients: ${clients.length}`);
  });
}

// Broadcast real-time events to all active dashboard clients
function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  clients.forEach(client => {
    client.res.write(`data: ${payload}\n\n`);
  });
}

module.exports = {
  handleRealtimeConnection,
  broadcast
};
