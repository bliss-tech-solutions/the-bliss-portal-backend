// src/hooks/useClientAttachmentSocket.js
import { useEffect, useState, useCallback } from 'react';
import {
    connectSocket,
    joinClientRoom,
    leaveClientRoom,
    onAttachmentAdded,
    onAttachmentUpdated,
    onAttachmentDeleted,
    offAttachmentAdded,
    offAttachmentUpdated,
    offAttachmentDeleted
} from '../utils/socket';

/**
 * Custom React Hook for real-time Client Attachment Management
 * @param {string} clientId - Client ID to monitor attachments for
 * @param {string} userId - Current user ID (optional)
 * @returns {object} - { attachments, newAttachment, updatedAttachment, deletedAttachmentId, setAttachments }
 */
export const useClientAttachmentSocket = (clientId, userId = null) => {
    const [attachments, setAttachments] = useState([]);
    const [newAttachment, setNewAttachment] = useState(null);
    const [updatedAttachment, setUpdatedAttachment] = useState(null);
    const [deletedAttachmentId, setDeletedAttachmentId] = useState(null);

    useEffect(() => {
        if (!clientId) return;

        // Connect to socket
        const socket = connectSocket();

        // Join client-specific room to receive attachment updates
        joinClientRoom(clientId);

        // ============================================
        // SOCKET EVENT HANDLERS
        // ============================================

        /**
         * Handle new attachment added
         */
        const handleAttachmentAdded = (data) => {
            // Only process if it's for this client
            if (data.clientId === clientId) {
                console.log('📥 New attachment added:', data);
                setNewAttachment(data.attachment);

                setAttachments((prev) => {
                    // Prevent duplicates
                    const exists = prev.some(a => a._id === data.attachment._id);
                    if (!exists) {
                        return [data.attachment, ...prev];
                    }
                    return prev;
                });
            }
        };

        /**
         * Handle attachment update
         */
        const handleAttachmentUpdated = (data) => {
            if (data.clientId === clientId) {
                console.log('📥 Attachment updated:', data);
                setUpdatedAttachment(data.attachment);

                setAttachments((prev) =>
                    prev.map((att) =>
                        att._id === data.attachmentId ? { ...att, ...data.attachment } : att
                    )
                );
            }
        };

        /**
         * Handle attachment deletion
         */
        const handleAttachmentDeleted = (data) => {
            if (data.clientId === clientId) {
                console.log('📥 Attachment deleted:', data);
                setDeletedAttachmentId(data.attachmentId);

                setAttachments((prev) =>
                    prev.filter((att) => att._id !== data.attachmentId)
                );
            }
        };

        // Subscribe to socket events
        onAttachmentAdded(handleAttachmentAdded);
        onAttachmentUpdated(handleAttachmentUpdated);
        onAttachmentDeleted(handleAttachmentDeleted);

        // ============================================
        // CLEANUP
        // ============================================
        return () => {
            offAttachmentAdded();
            offAttachmentUpdated();
            offAttachmentDeleted();
            leaveClientRoom(clientId);
            console.log('🧹 Cleaned up attachment socket listeners for client:', clientId);
        };
    }, [clientId]);

    /**
     * Function to manually refresh/set attachments (e.g., after initial API fetch)
     */
    const refreshAttachments = useCallback((attachmentsData) => {
        setAttachments(attachmentsData || []);
    }, []);

    return {
        attachments,             // Current list of attachments
        newAttachment,           // Last added attachment
        updatedAttachment,       // Last updated attachment
        deletedAttachmentId,     // Last deleted attachment ID
        setAttachments: refreshAttachments  // Function to manually set attachments
    };
};
