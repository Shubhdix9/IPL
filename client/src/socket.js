import { io } from 'socket.io-client';

// Connect to backend (adjust URL when deploying)
const socket = io(import.meta.env.VITE_API_URL + '');

export default socket;
