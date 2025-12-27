# Frontend Socket.IO Implementation Guide for Client Management Real-Time Updates

## Overview
The backend is already configured to emit Socket.IO events for all Client Management operations (create, update, delete, attachments). This guide shows how to implement real-time updates in your frontend React application **without page reloads**.

---

## Backend Socket Events (Already Implemented ✅)

### Client Events:

1. **`client:created`** - Emitted globally when a new client is created
   ```javascript
   {
     clientId: "client_id_string",
     client: { /* full client object */ }
   }
   ```

2. **`client:updated`** - Emitted globally when client is updated
   ```javascript
   {
     clientId: "client_id_string",
     client: { /* full updated client object */ }
   }
   ```

3. **`client:deleted`** - Emitted globally when client is deleted
   ```javascript
   {
     clientId: "client_id_string",
     clientName: "client name"
   }
   ```

4. **`client:assigned`** - Emitted to user rooms when they are assigned to a client
   ```javascript
   {
     clientId: "client_id_string",
     client: { /* full client object */ }
   }
   ```

### Attachment Events:

5. **`client:attachment:added`** - Emitted when attachment is added
   ```javascript
   {
     clientId: "client_id_string",
     userId: "uploader_user_id",
     attachment: { /* attachment object */ }
   }
   ```

6. **`client:attachment:updated`** - Emitted when attachment is updated
   ```javascript
   {
     clientId: "client_id_string",
     attachmentId: "attachment_id",
     userId: "uploader_user_id",
     attachment: { /* updated attachment object */ }
   }
   ```

7. **`client:attachment:deleted`** - Emitted when attachment is deleted
   ```javascript
   {
     clientId: "client_id_string",
     attachmentId: "attachment_id",
     userId: "uploader_user_id"
   }
   ```

---

## Frontend Implementation Steps

### Step 1: Install Socket.IO Client

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

### Step 2: Create Socket Connection Utility

Create file: `src/utils/socket.js`

```javascript
import { io } from 'socket.io-client';

// Your backend URL
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

let socket = null;

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
      console.error('Socket connection error:', error);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

// Client Management specific socket helpers
export const joinClientRoom = (clientId) => {
  if (socket && clientId) {
    socket.emit('joinClient', clientId);
    console.log('Joined client room:', clientId);
  }
};

export const leaveClientRoom = (clientId) => {
  if (socket && clientId) {
    socket.emit('leaveClient', clientId);
    console.log('Left client room:', clientId);
  }
};

export const joinUserRoom = (userId) => {
  if (socket && userId) {
    socket.emit('joinUser', userId);
    console.log('Joined user room:', userId);
  }
};

export const joinClientUserRoom = (clientId, userId) => {
  if (socket && clientId && userId) {
    socket.emit('joinClientUser', { clientId, userId });
    console.log('Joined client-user room:', clientId, userId);
  }
};

export const leaveClientUserRoom = (clientId, userId) => {
  if (socket && clientId && userId) {
    socket.emit('leaveClientUser', { clientId, userId });
    console.log('Left client-user room:', clientId, userId);
  }
};
```

---

### Step 3: Create React Hook for Client Management

Create file: `src/hooks/useClientSocket.js`

```javascript
import { useEffect, useState, useCallback } from 'react';
import { connectSocket, getSocket, joinUserRoom } from '../utils/socket';

export const useClientSocket = (userId = null) => {
  const [clients, setClients] = useState([]);
  const [newClient, setNewClient] = useState(null);
  const [updatedClient, setUpdatedClient] = useState(null);
  const [deletedClientId, setDeletedClientId] = useState(null);

  useEffect(() => {
    const socket = connectSocket();

    // Join user room if userId provided (to get assigned clients)
    if (userId) {
      joinUserRoom(userId);
    }

    // Listen for new clients
    socket.on('client:created', (data) => {
      console.log('📥 New client created:', data);
      setNewClient(data.client);
      
      setClients((prevClients) => {
        // Prevent duplicates
        const exists = prevClients.some(c => c._id === data.clientId);
        if (!exists) {
          return [data.client, ...prevClients];
        }
        return prevClients;
      });
    });

    // Listen for client updates
    socket.on('client:updated', (data) => {
      console.log('📥 Client updated:', data);
      setUpdatedClient(data.client);
      
      setClients((prevClients) =>
        prevClients.map((client) =>
          client._id === data.clientId ? { ...client, ...data.client } : client
        )
      );
    });

    // Listen for client deletions
    socket.on('client:deleted', (data) => {
      console.log('📥 Client deleted:', data);
      setDeletedClientId(data.clientId);
      
      setClients((prevClients) =>
        prevClients.filter((client) => client._id !== data.clientId)
      );
    });

    // Listen for client assigned to current user
    if (userId) {
      socket.on('client:assigned', (data) => {
        console.log('📥 Client assigned to you:', data);
        setNewClient(data.client);
        
        setClients((prevClients) => {
          const exists = prevClients.some(c => c._id === data.clientId);
          if (!exists) {
            return [data.client, ...prevClients];
          }
          return prevClients;
        });
      });
    }

    // Cleanup on unmount
    return () => {
      socket.off('client:created');
      socket.off('client:updated');
      socket.off('client:deleted');
      socket.off('client:assigned');
    };
  }, [userId]);

  const refreshClients = useCallback((clientsData) => {
    setClients(clientsData);
  }, []);

  return { 
    clients, 
    newClient, 
    updatedClient, 
    deletedClientId, 
    setClients: refreshClients 
  };
};
```

---

### Step 4: Create React Hook for Client Attachments

Create file: `src/hooks/useClientAttachmentSocket.js`

```javascript
import { useEffect, useState, useCallback } from 'react';
import { connectSocket, getSocket, joinClientRoom, leaveClientRoom } from '../utils/socket';

export const useClientAttachmentSocket = (clientId, userId = null) => {
  const [attachments, setAttachments] = useState([]);
  const [newAttachment, setNewAttachment] = useState(null);
  const [updatedAttachment, setUpdatedAttachment] = useState(null);
  const [deletedAttachmentId, setDeletedAttachmentId] = useState(null);

  useEffect(() => {
    if (!clientId) return;

    const socket = connectSocket();

    // Join client-specific room
    joinClientRoom(clientId);

    // Listen for new attachments
    socket.on('client:attachment:added', (data) => {
      if (data.clientId === clientId) {
        console.log('📥 New attachment added:', data);
        setNewAttachment(data.attachment);
        
        setAttachments((prev) => {
          const exists = prev.some(a => a._id === data.attachment._id);
          if (!exists) {
            return [data.attachment, ...prev];
          }
          return prev;
        });
      }
    });

    // Listen for attachment updates
    socket.on('client:attachment:updated', (data) => {
      if (data.clientId === clientId) {
        console.log('📥 Attachment updated:', data);
        setUpdatedAttachment(data.attachment);
        
        setAttachments((prev) =>
          prev.map((att) =>
            att._id === data.attachmentId ? { ...att, ...data.attachment } : att
          )
        );
      }
    });

    // Listen for attachment deletions
    socket.on('client:attachment:deleted', (data) => {
      if (data.clientId === clientId) {
        console.log('📥 Attachment deleted:', data);
        setDeletedAttachmentId(data.attachmentId);
        
        setAttachments((prev) =>
          prev.filter((att) => att._id !== data.attachmentId)
        );
      }
    });

    // Cleanup on unmount
    return () => {
      socket.off('client:attachment:added');
      socket.off('client:attachment:updated');
      socket.off('client:attachment:deleted');
      leaveClientRoom(clientId);
    };
  }, [clientId]);

  const refreshAttachments = useCallback((attachmentsData) => {
    setAttachments(attachmentsData);
  }, []);

  return { 
    attachments, 
    newAttachment, 
    updatedAttachment, 
    deletedAttachmentId, 
    setAttachments: refreshAttachments 
  };
};
```

---

### Step 5: Client List Component with Real-Time Updates

Create file: `src/components/ClientManagement/ClientList.jsx`

```javascript
import React, { useEffect, useState } from 'react';
import { useClientSocket } from '../../hooks/useClientSocket';
import { connectSocket } from '../../utils/socket';

const ClientList = ({ currentUserId, apiUrl = '/api' }) => {
  const { clients, newClient, updatedClient, deletedClientId, setClients } = useClientSocket(currentUserId);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Initial fetch of clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const endpoint = currentUserId 
          ? `${apiUrl}/clientmanagement/getClientsByUserId/${currentUserId}`
          : `${apiUrl}/clientmanagement/getAllClientsData`;
        
        const response = await fetch(endpoint);
        const result = await response.json();
        
        if (result.success) {
          setClients(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [currentUserId, setClients, apiUrl]);

  // Initialize socket
  useEffect(() => {
    connectSocket();
  }, []);

  // Show notification for new clients
  useEffect(() => {
    if (newClient) {
      showNotification(`New client created: ${newClient.clientName}`, 'success');
    }
  }, [newClient]);

  // Show notification for updated clients
  useEffect(() => {
    if (updatedClient) {
      showNotification(`Client updated: ${updatedClient.clientName}`, 'info');
    }
  }, [updatedClient]);

  // Show notification for deleted clients
  useEffect(() => {
    if (deletedClientId) {
      showNotification(`Client deleted`, 'warning');
    }
  }, [deletedClientId]);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  if (loading) {
    return <div className="loading">Loading clients...</div>;
  }

  return (
    <div className="client-list-container">
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <h2>Client Management</h2>
      
      {clients.length === 0 ? (
        <p className="no-data">No clients found</p>
      ) : (
        <div className="client-grid">
          {clients.map((client) => (
            <div key={client._id} className="client-card">
              <h3>{client.clientName}</h3>
              <p><strong>City:</strong> {client.city}</p>
              <p><strong>Status:</strong> {client.status}</p>
              <p><strong>Onboard Date:</strong> {new Date(client.onboardDate).toLocaleDateString()}</p>
              <p><strong>Data Received:</strong> {client.itsDataReceived ? 'Yes' : 'No'}</p>
              
              {client.assignedUsers && client.assignedUsers.length > 0 && (
                <div className="assigned-users">
                  <strong>Assigned Users:</strong>
                  <ul>
                    {client.assignedUsers.map((user, index) => (
                      <li key={index}>{user.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientList;
```

---

### Step 6: Client Detail Component with Attachments

Create file: `src/components/ClientManagement/ClientDetail.jsx`

```javascript
import React, { useEffect, useState } from 'react';
import { useClientAttachmentSocket } from '../../hooks/useClientAttachmentSocket';
import { connectSocket, joinClientRoom, leaveClientRoom } from '../../utils/socket';

const ClientDetail = ({ clientId, currentUserId, apiUrl = '/api' }) => {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const { 
    attachments, 
    newAttachment, 
    updatedAttachment, 
    deletedAttachmentId, 
    setAttachments 
  } = useClientAttachmentSocket(clientId, currentUserId);

  // Fetch client data
  useEffect(() => {
    if (!clientId) return;

    const fetchClient = async () => {
      try {
        const response = await fetch(`${apiUrl}/clientmanagement/getById/${clientId}`);
        const result = await response.json();
        
        if (result.success) {
          setClient(result.data);
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientId, apiUrl]);

  // Fetch attachments
  useEffect(() => {
    if (!clientId) return;

    const fetchAttachments = async () => {
      try {
        const endpoint = currentUserId
          ? `${apiUrl}/clientmanagement/${clientId}/attachments/byUserId/${currentUserId}`
          : `${apiUrl}/clientmanagement/${clientId}/attachments`;
        
        const response = await fetch(endpoint);
        const result = await response.json();
        
        if (result.success) {
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

  // Initialize socket and join rooms
  useEffect(() => {
    connectSocket();
  }, []);

  // Notifications for attachment changes
  useEffect(() => {
    if (newAttachment) {
      console.log('New attachment added:', newAttachment);
      // You can add toast notification here
    }
  }, [newAttachment]);

  useEffect(() => {
    if (updatedAttachment) {
      console.log('Attachment updated:', updatedAttachment);
    }
  }, [updatedAttachment]);

  useEffect(() => {
    if (deletedAttachmentId) {
      console.log('Attachment deleted:', deletedAttachmentId);
    }
  }, [deletedAttachmentId]);

  if (loading || !client) {
    return <div className="loading">Loading client details...</div>;
  }

  return (
    <div className="client-detail-container">
      <div className="client-info">
        <h2>{client.clientName}</h2>
        <p><strong>City:</strong> {client.city}</p>
        <p><strong>Status:</strong> {client.status}</p>
        <p><strong>Onboard Date:</strong> {new Date(client.onboardDate).toLocaleDateString()}</p>
        <p><strong>Data Received:</strong> {client.itsDataReceived ? 'Yes' : 'No'}</p>
      </div>

      <div className="attachments-section">
        <h3>Attachments ({attachments.length})</h3>
        
        {attachments.length === 0 ? (
          <p>No attachments found</p>
        ) : (
          <div className="attachments-list">
            {attachments.map((attachment) => (
              <div key={attachment._id} className="attachment-card">
                <p><strong>Month:</strong> {attachment.month}</p>
                <p><strong>Link:</strong> <a href={attachment.link} target="_blank" rel="noopener noreferrer">{attachment.link}</a></p>
                {attachment.notes && <p><strong>Notes:</strong> {attachment.notes}</p>}
                <p><strong>Uploaded by:</strong> {attachment.uploadedBy.name}</p>
                <p><strong>Date:</strong> {new Date(attachment.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetail;
```

---

### Step 7: Initialize Socket in App Component

In your main `App.js`:

```javascript
import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from './utils/socket';
import ClientList from './components/ClientManagement/ClientList';

function App() {
  const currentUserId = 'your-user-id'; // Get from auth context

  useEffect(() => {
    // Connect socket when app loads
    connectSocket();

    // Disconnect on unmount
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <div className="App">
      <ClientList currentUserId={currentUserId} />
    </div>
  );
}

export default App;
```

---

## API Endpoints Reference

All endpoints are already implemented in your backend:

### Client Endpoints:
- `GET /api/clientmanagement/getAllClientsData` - Get all clients
- `GET /api/clientmanagement/getById/:clientId` - Get client by ID
- `GET /api/clientmanagement/getClientsByUserId/:userId` - Get clients by user
- `POST /api/clientmanagement/create` - Create new client
- `PUT /api/clientmanagement/update/:clientId` - Update client
- `DELETE /api/clientmanagement/delete/:clientId` - Delete client

### Attachment Endpoints:
- `GET /api/clientmanagement/:clientId/attachments` - Get all attachments
- `GET /api/clientmanagement/:clientId/attachments/byUserId/:userId` - Get attachments for user
- `POST /api/clientmanagement/:clientId/attachments` - Add attachment
- `PUT /api/clientmanagement/:clientId/attachments/:attachmentId` - Update attachment
- `DELETE /api/clientmanagement/:clientId/attachments/:attachmentId` - Delete attachment

---

## Testing Real-Time Updates

1. **Open two browser windows/tabs**
2. **In Window 1**: View the client list
3. **In Window 2**: Create a new client using the API
4. **Result**: The new client should appear in Window 1 **without refresh**
5. **Test Update**: Update a client in Window 2, see it update in Window 1
6. **Test Delete**: Delete a client in Window 2, see it disappear from Window 1
7. **Test Attachments**: Add/update/delete attachments and see real-time changes

---

## Environment Variables

Add to your `.env` file:

```bash
REACT_APP_API_URL=http://localhost:3000
# or for production
REACT_APP_API_URL=https://your-backend-url.com
```

---

## Key Features ✅

✅ Real-time client creation updates
✅ Real-time client updates
✅ Real-time client deletion
✅ Real-time attachment management
✅ User-specific room subscriptions
✅ Client-specific room subscriptions
✅ No page reloads required
✅ Duplicate prevention
✅ Proper cleanup on component unmount
✅ Notification support

---

## Troubleshooting

- **Socket not connecting**: Check `REACT_APP_API_URL` and backend CORS settings
- **Events not received**: Verify room subscriptions (`joinClient`, `joinUser`)
- **Duplicate items**: Hooks already include duplicate prevention logic
- **Stale data**: Make sure to call socket cleanup functions on unmount

---

## Next Steps

1. Install `socket.io-client` in your frontend project
2. Copy the socket utility file
3. Create the custom hooks
4. Integrate into your existing components
5. Test with multiple browser windows
6. Add toast notifications (e.g., `react-toastify`)
7. Style components to match your design

Your backend is **already fully configured** for real-time updates! 🎉
