// Mock Cloudflare challenge script for local testing
console.log('Mock Cloudflare script loaded');

// Define the expected Cloudflare parameters to avoid errors
window.__CF$cv$params = {
    r: 'mock-request-id', // Mock request ID
    t: 'mock-timestamp'   // Mock timestamp
};

// Optional: Add a simple function to simulate Cloudflare behavior
(function() {
    console.log('Mock Cloudflare challenge platform initialized');
})();