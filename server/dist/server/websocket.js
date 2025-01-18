export function setupWebSocket(wss) {
    wss.on('connection', (ws) => {
        // Handle incoming messages
        ws.on('message', (message) => {
            console.log('Received:', message);
        });
        // Handle client disconnection
        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
}
