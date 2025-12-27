// src/hooks/useClientSocket.js
import { useEffect, useState, useCallback } from 'react';
import {
    connectSocket,
    joinUserRoom,
    onClientCreated,
    onClientUpdated,
    onClientDeleted,
    offClientCreated,
    offClientUpdated,
    offClientDeleted
} from '../utils/socket';

/**
 * Custom React Hook for real-time Client Management
 * @param {string} userId - Current user ID (optional, for filtering assigned clients)
 * @returns {object} - { clients, newClient, updatedClient, deletedClientId, setClients }
 */
export const useClientSocket = (userId = null) => {
    const [clients, setClients] = useState([]);
    const [newClient, setNewClient] = useState(null);
    const [updatedClient, setUpdatedClient] = useState(null);
    const [deletedClientId, setDeletedClientId] = useState(null);

    useEffect(() => {
        // Connect to socket
        const socket = connectSocket();

        // Join user room if userId is provided
        if (userId) {
            joinUserRoom(userId);
        }

        // ============================================
        // SOCKET EVENT HANDLERS
        // ============================================

        /**
         * Handle new client creation
         */
        const handleClientCreated = (data) => {
            console.log('📥 New client created:', data);
            setNewClient(data.client);

            setClients((prevClients) => {
                // Prevent duplicates
                const exists = prevClients.some(c => c._id === data.clientId || c._id === data.client._id);
                if (!exists) {
                    return [data.client, ...prevClients];
                }
                return prevClients;
            });
        };

        /**
         * Handle client update
         */
        const handleClientUpdated = (data) => {
            console.log('📥 Client updated:', data);
            setUpdatedClient(data.client);

            setClients((prevClients) =>
                prevClients.map((client) =>
                    client._id === data.clientId ? { ...client, ...data.client } : client
                )
            );
        };

        /**
         * Handle client deletion
         */
        const handleClientDeleted = (data) => {
            console.log('📥 Client deleted:', data);
            setDeletedClientId(data.clientId);

            setClients((prevClients) =>
                prevClients.filter((client) => client._id !== data.clientId)
            );
        };

        // Subscribe to socket events
        onClientCreated(handleClientCreated);
        onClientUpdated(handleClientUpdated);
        onClientDeleted(handleClientDeleted);

        // ============================================
        // CLEANUP
        // ============================================
        return () => {
            offClientCreated();
            offClientUpdated();
            offClientDeleted();
            console.log('🧹 Cleaned up client socket listeners');
        };
    }, [userId]);

    /**
     * Function to manually refresh/set clients (e.g., after initial API fetch)
     */
    const refreshClients = useCallback((clientsData) => {
        setClients(clientsData || []);
    }, []);

    return {
        clients,           // Current list of clients
        newClient,         // Last created client
        updatedClient,     // Last updated client
        deletedClientId,   // Last deleted client ID
        setClients: refreshClients  // Function to manually set clients
    };
};
