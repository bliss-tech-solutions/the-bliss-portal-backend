// src/components/ClientManagement/ClientList.jsx
import React, { useEffect, useState } from 'react';
import { useClientSocket } from '../../hooks/useClientSocket';
import { connectSocket } from '../../utils/socket';
import './ClientList.css'; // Your styles

/**
 * ClientList Component - Real-time Client Management List
 * Shows all clients with automatic real-time updates (no refresh needed)
 * 
 * @param {string} currentUserId - Current logged-in user ID (optional)
 * @param {string} apiUrl - Base API URL (default: '/api')
 */
const ClientList = ({ currentUserId = null, apiUrl = '/api' }) => {
    const {
        clients,
        newClient,
        updatedClient,
        deletedClientId,
        setClients
    } = useClientSocket(currentUserId);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState(null);

    // ============================================
    // INITIAL DATA FETCH
    // ============================================
    useEffect(() => {
        const fetchClients = async () => {
            try {
                setLoading(true);
                setError(null);

                // Choose endpoint based on whether we're filtering by user
                const endpoint = currentUserId
                    ? `${apiUrl}/clientmanagement/getClientsByUserId/${currentUserId}`
                    : `${apiUrl}/clientmanagement/getAllClientsData`;

                const response = await fetch(endpoint);
                const result = await response.json();

                if (result.success) {
                    setClients(result.data || []);
                } else {
                    setError(result.message || 'Failed to load clients');
                }
            } catch (error) {
                console.error('Error fetching clients:', error);
                setError('Failed to load clients. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, [currentUserId, setClients, apiUrl]);

    // ============================================
    // INITIALIZE SOCKET CONNECTION
    // ============================================
    useEffect(() => {
        connectSocket();
    }, []);

    // ============================================
    // REAL-TIME NOTIFICATIONS
    // ============================================

    // Show notification when new client is created
    useEffect(() => {
        if (newClient) {
            showNotification(
                `✅ New client created: ${newClient.clientName}`,
                'success'
            );
        }
    }, [newClient]);

    // Show notification when client is updated
    useEffect(() => {
        if (updatedClient) {
            showNotification(
                `ℹ️ Client updated: ${updatedClient.clientName}`,
                'info'
            );
        }
    }, [updatedClient]);

    // Show notification when client is deleted
    useEffect(() => {
        if (deletedClientId) {
            showNotification(
                `⚠️ Client deleted`,
                'warning'
            );
        }
    }, [deletedClientId]);

    /**
     * Show a temporary notification
     */
    const showNotification = (message, type) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    // ============================================
    // RENDER LOGIC
    // ============================================

    if (loading) {
        return (
            <div className="client-list-container">
                <div className="loading-spinner">
                    <p>Loading clients...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="client-list-container">
                <div className="error-message">
                    <p>❌ {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="client-list-container">
            {/* Real-time Notification Toast */}
            {notification && (
                <div className={`notification notification-${notification.type}`}>
                    {notification.message}
                </div>
            )}

            <div className="header">
                <h2>Client Management</h2>
                <p className="client-count">
                    Total Clients: <strong>{clients.length}</strong>
                </p>
            </div>

            {clients.length === 0 ? (
                <div className="no-data">
                    <p>📋 No clients found</p>
                    {currentUserId && <p className="hint">No clients are assigned to you yet.</p>}
                </div>
            ) : (
                <div className="client-grid">
                    {clients.map((client) => (
                        <div key={client._id} className="client-card">
                            <div className="client-header">
                                <h3>{client.clientName}</h3>
                                <span className={`status-badge status-${client.status}`}>
                                    {client.status}
                                </span>
                            </div>

                            <div className="client-details">
                                <div className="detail-row">
                                    <span className="label">🏙️ City:</span>
                                    <span className="value">{client.city}</span>
                                </div>

                                <div className="detail-row">
                                    <span className="label">📅 Onboard Date:</span>
                                    <span className="value">
                                        {new Date(client.onboardDate).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>

                                <div className="detail-row">
                                    <span className="label">📊 Data Received:</span>
                                    <span className={`value ${client.itsDataReceived ? 'yes' : 'no'}`}>
                                        {client.itsDataReceived ? '✅ Yes' : '❌ No'}
                                    </span>
                                </div>

                                {client.assignedUsers && client.assignedUsers.length > 0 && (
                                    <div className="assigned-users">
                                        <span className="label">👥 Assigned Users:</span>
                                        <ul className="user-list">
                                            {client.assignedUsers.map((user, index) => (
                                                <li key={index} className="user-chip">
                                                    {user.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="client-footer">
                                <button
                                    className="btn-view"
                                    onClick={() => window.location.href = `/clients/${client._id}`}
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientList;
