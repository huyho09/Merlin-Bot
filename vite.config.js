export default {
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:2138',
                changeOrigin: true,
                secure: false
            }
        }
    }
}