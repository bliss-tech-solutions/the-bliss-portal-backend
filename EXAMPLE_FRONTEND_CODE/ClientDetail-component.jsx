// src/components/ClientManagement/ClientDetail.jsx
import React, { useEffect, useState } from 'react';
import { useClientAttachmentSocket } from '../../hooks/useClientAttachmentSocket';
import { connectSocket } from '../../utils/socket';
import './ClientDetail.css'; // Your styles

/**
 * ClientDetail Component - Real-time Client Detail with Attachments
 * Shows client information and attachments with automatic real-time updates
 * 
 * @param {string} clientId - Client ID to display
 * @param {string} currentUserId - Current logged-in user ID (optional)
 * @param {string} apiUrl - Base API URL (default: '/api')
 */
const ClientDetail = ({ clientId, currentUserId = null, apiUrl = '/api' }) => {
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState(null);

    // Use the attachment socket hook for real-time updates
    const {
        attachments,
        newAttachment,
        updatedAttachment,
        deletedAttachmentId,
        setAttachments
    } = useClientAttachmentSocket(clientId, currentUserId);

    // ============================================
    // FETCH CLIENT DATA
    // ============================================
    useEffect(() => {
        if (!clientId) return;

        const fetchClient = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${apiUrl}/clientmanagement/getById/${clientId}`);
                const result = await response.json();

                if (result.success) {
                    setClient(result.data);
                } else {
                    setError(result.message || 'Client not found');
                }
            } catch (error) {
                console.error('Error fetching client:', error);
                setError('Failed to load client details');
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [clientId, apiUrl]);

    // ============================================
    // FETCH ATTACHMENTS
    // ============================================
    useEffect(() => {
        if (!clientId) return;

        const fetchAttachments = async () => {
            try {
                // Choose endpoint based on whether we have a userId
                const endpoint = currentUserId
                    ? `${apiUrl}/clientmanagement/${clientId}/attachments/byUserId/${currentUserId}`
                    : `${apiUrl}/clientmanagement/${clientId}/attachments`;

                const response = await fetch(endpoint);
                const result = await response.json();

                if (result.success) {
                    // Handle different response structures
                    const attachmentsData = currentUserId
                        ? result.data.attachments || []
                        : result.data || [];
                    setAttachments(attachmentsData);
                }
            } catch (error) {
                console.error('Error fetching attachments:', error);
            }
        };

        fetchAttachments();
    }, [clientId, currentUserId, setAttachments, apiUrl]);

    // ============================================
    // INITIALIZE SOCKET CONNECTION
    // ============================================
    useEffect(() => {
        connectSocket();
    }, []);

    // ============================================
    // REAL-TIME NOTIFICATIONS FOR ATTACHMENTS
    // ============================================

    useEffect(() => {
        if (newAttachment) {
            showNotification(
                `✅ New attachment added for ${newAttachment.month}`,
                'success'
            );
        }
    }, [newAttachment]);

    useEffect(() => {
        if (updatedAttachment) {
            showNotification(
                `ℹ️ Attachment updated`,
                'info'
            );
        }
    }, [updatedAttachment]);

    useEffect(() => {
        if (deletedAttachmentId) {
            showNotification(
                `⚠️ Attachment deleted`,
                'warning'
            );
        }
    }, [deletedAttachmentId]);

    /**
     * Show a temporary notification
     */
    const showNotification = (message, type) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // ============================================
    // RENDER LOGIC
    // ============================================

    if (loading) {
        return (
            <div className="client-detail-container">
                <div className="loading-spinner">
                    <p>Loading client details...</p>
                </div>
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className="client-detail-container">
                <div className="error-message">
                    <p>❌ {error || 'Client not found'}</p>
                    <button onClick={() => window.history.back()}>Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="client-detail-container">
            {/* Real-time Notification Toast */}
            {notification && (
                <div className={`notification notification-${notification.type}`}>
                    {notification.message}
                </div>
            )}

            {/* Client Information Section */}
            <div className="client-info-card">
                <div className="card-header">
                    <h1>{client.clientName}</h1>
                    <span className={`status-badge status-${client.status}`}>
                        {client.status}
                    </span>
                </div>

                <div className="client-info-grid">
                    <div className="info-item">
                        <span className="label">🏙️ City</span>
                        <span className="value">{client.city}</span>
                    </div>

                    <div className="info-item">
                        <span className="label">📅 Onboard Date</span>
                        <span className="value">
                            {new Date(client.onboardDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </span>
                    </div>

                    <div className="info-item">
                        <span className="label">📊 Data Received</span>
                        <span className={`value ${client.itsDataReceived ? 'yes' : 'no'}`}>
                            {client.itsDataReceived ? '✅ Yes' : '❌ No'}
                        </span>
                    </div>

                    {client.assignedUsers && client.assignedUsers.length > 0 && (
                        <div className="info-item full-width">
                            <span className="label">👥 Assigned Users</span>
                            <div className="user-chips">
                                {client.assignedUsers.map((user, index) => (
                                    <span key={index} className="user-chip">
                                        {user.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Attachments Section */}
            <div className="attachments-section">
                <div className="section-header">
                    <h2>📎 Attachments</h2>
                    <span className="count-badge">{attachments.length}</span>
                </div>

                {attachments.length === 0 ? (
                    <div className="no-attachments">
                        <p>📋 No attachments found</p>
                        <p className="hint">Attachments will appear here in real-time when added.</p>
                    </div>
                ) : (
                    <div className="attachments-grid">
                        {attachments.map((attachment) => (
                            <div key={attachment._id} className="attachment-card">
                                <div className="attachment-header">
                                    <span className="month-badge">{attachment.month}</span>
                                    <span className="upload-date">
                                        {new Date(attachment.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>

                                <div className="attachment-body">
                                    <div className="attachment-link">
                                        <span className="label">🔗 Link:</span>
                                        <a
                                            href={attachment.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="link-value"
                                        >
                                            {attachment.link.length > 50
                                                ? attachment.link.substring(0, 50) + '...'
                                                : attachment.link}
                                        </a>
                                    </div>

                                    {attachment.notes && (
                                        <div className="attachment-notes">
                                            <span className="label">📝 Notes:</span>
                                            <p className="notes-value">{attachment.notes}</p>
                                        </div>
                                    )}

                                    <div className="attachment-footer">
                                        <span className="uploaded-by">
                                            👤 Uploaded by: <strong>{attachment.uploadedBy.name}</strong>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Back Button */}
            <div className="actions">
                <button
                    className="btn-back"
                    onClick={() => window.history.back()}
                >
                    ← Back to Clients
                </button>
            </div>
        </div>
    );
};

export default ClientDetail;
