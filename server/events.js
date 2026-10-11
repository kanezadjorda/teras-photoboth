/**
 * Server-Sent Events (SSE) Manager
 * Handles real-time synchronization between kiosk and admin screens
 */

const clients = new Set();

/**
 * Express middleware/handler for /events SSE connection
 */
export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  res.write(': connected\n\n');

  clients.add(res);

  req.on('close', () => {
    clients.delete(res);
  });
}

/**
 * Broadcast event to all connected clients
 * @param {string} eventName
 * @param {object} data
 */
export function broadcastEvent(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

