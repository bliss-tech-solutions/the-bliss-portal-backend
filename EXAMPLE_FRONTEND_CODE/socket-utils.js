// src/utils/socket.js
import { io } from 'socket.io-client';

// Your backend URL - Update this based on your environment
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

let socket = null;

/**
 * Initialize and connect to Socket.IO server
 * Call this once when your app loads
 */
export const connectSocket = () => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        });
    }
    return socket;
};

/**
 * Disconnect from Socket.IO server
 * Call this when your app unmounts (cleanup)
 */
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('🔌 Socket disconnected and cleared');
    }
};

/**
 * Get the current socket instance
 * Use this to access the socket in components
 */
export const getSocket = () => socket;

// ============================================
// CLIENT MANAGEMENT ROOM SUBSCRIPTIONS
// ============================================

/**
 * Join a specific client room to receive updates for that client
 * @param {string} clientId - The client ID
 */
export const joinClientRoom = (clientId) => {
    if (socket && clientId) {
        socket.emit('joinClient', clientId);
        console.log('🏢 Joined client room:', clientId);
    }
};

/**
 * Leave a specific client room
 * @param {string} clientId - The client ID
 */
export const leaveClientRoom = (clientId) => {
    if (socket && clientId) {
        socket.emit('leaveClient', clientId);
        console.log('👋 Left client room:', clientId);
    }
};

/**
 * Join a user room to receive updates for clients assigned to this user
 * @param {string} userId - The user ID
 */
export const joinUserRoom = (userId) => {
    if (socket && userId) {
        socket.emit('joinUser', userId);
        console.log('👤 Joined user room:', userId);
    }
};

/**
 * Join a combined client-user room for filtered attachment views
 * @param {string} clientId - The client ID
 * @param {string} userId - The user ID
 */
export const joinClientUserRoom = (clientId, userId) => {
    if (socket && clientId && userId) {
        socket.emit('joinClientUser', { clientId, userId });
        console.log('🔗 Joined client-user room:', clientId, userId);
    }
};

/**
 * Leave a combined client-user room
 * @param {string} clientId - The client ID
 * @param {string} userId - The user ID
 */
export const leaveClientUserRoom = (clientId, userId) => {
    if (socket && clientId && userId) {
        socket.emit('leaveClientUser', { clientId, userId });
        console.log('👋 Left client-user room:', clientId, userId);
    }
};

// ============================================
// SOCKET EVENT LISTENERS
// ============================================

/**
 * Subscribe to a client creation event
 * @param {function} callback - Function to call when event is received
 */
export const onClientCreated = (callback) => {
    if (socket) {
        socket.on('client:created', callback);
    }
};

/**
 * Unsubscribe from client creation event
 */
export const offClientCreated = () => {
    if (socket) {
        socket.off('client:created');
    }
};

/**
 * Subscribe to a client update event
 * @param {function} callback - Function to call when event is received
 */
export const onClientUpdated = (callback) => {
    if (socket) {
        socket.on('client:updated', callback);
    }
};

/**
 * Unsubscribe from client update event
 */
export const offClientUpdated = () => {
    if (socket) {
        socket.off('client:updated');
    }
};

/**
 * Subscribe to a client deletion event
 * @param {function} callback - Function to call when event is received
 */
export const onClientDeleted = (callback) => {
    if (socket) {
        socket.on('client:deleted', callback);
    }
};

/**
 * Unsubscribe from client deletion event
 */
export const offClientDeleted = () => {
    if (socket) {
        socket.off('client:deleted');
    }
};

/**
 * Subscribe to attachment added event
 * @param {function} callback - Function to call when event is received
 */
export const onAttachmentAdded = (callback) => {
    if (socket) {
        socket.on('client:attachment:added', callback);
    }
};

/**
 * Unsubscribe from attachment added event
 */
export const offAttachmentAdded = () => {
    if (socket) {
        socket.off('client:attachment:added');
    }
};

/**
 * Subscribe to attachment updated event
 * @param {function} callback - Function to call when event is received
 */
export const onAttachmentUpdated = (callback) => {
    if (socket) {
        socket.on('client:attachment:updated', callback);
    }
};

/**
 * Unsubscribe from attachment updated event
 */
export const offAttachmentUpdated = () => {
    if (socket) {
        socket.off('client:attachment:updated');
    }
};

/**
 * Subscribe to attachment deleted event
 * @param {function} callback - Function to call when event is received
 */
export const onAttachmentDeleted = (callback) => {
    if (socket) {
        socket.on('client:attachment:deleted', callback);
    }
};

/**
 * Unsubscribe from attachment deleted event
 */
export const offAttachmentDeleted = () => {
    if (socket) {
        socket.off('client:attachment:deleted');
    }
};
