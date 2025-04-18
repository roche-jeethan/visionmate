import { Platform } from 'react-native';

const SERVER_IP = process.env.SERVER_IP;
const WS_URL = Platform.select({
    native: `ws://${SERVER_IP}:8000/ws/video`,
    default: 'ws://localhost:8000/ws/video',
});

export { SERVER_IP, WS_URL };