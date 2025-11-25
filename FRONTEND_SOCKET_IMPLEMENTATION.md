# Frontend Socket.IO Implementation Guide for Real-Time Task Updates

## Overview
The backend now emits Socket.IO events when tasks are created or updated. This guide shows how to implement real-time updates in your frontend.

## Backend Socket Events

### Events Emitted:

1. **`task:new`** - Emitted globally when a new task is created
   ```javascript
   {
     taskId: "task_id_string",
     task: { /* full task object */ }
   }
   ```

2. **`task:created`** - Emitted to task room and user rooms when task is created
   ```javascript
   {
     taskId: "task_id_string",
     task: { /* full task object */ }
   }
   ```

3. **`task:assigned`** - Emitted to receiver user room when task is assigned
   ```javascript
   {
     taskId: "task_id_string",
     task: { /* full task object */ }
   }
   ```

4. **`task:updated`** - Emitted globally when task is updated
   ```javascript
   {
     taskId: "task_id_string",
     taskStatus: "pending" | "completed",
     task: { /* full updated task object */ }
   }
   ```

5. **`task:statusUpdated`** - Emitted to task room and user rooms when status changes
   ```javascript
   {
     taskId: "task_id_string",
     taskStatus: "pending" | "completed",
     task: { /* full updated task object */ }
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

Create a file: `src/utils/socket.js` or `src/services/socket.js`

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
```

### Step 3: Create React Hook for Tasks

Create: `src/hooks/useTaskSocket.js`

```javascript
import { useEffect, useState } from 'react';
import { connectSocket, getSocket } from '../utils/socket';

export const useTaskSocket = (userId = null) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState(null);
  const [updatedTask, setUpdatedTask] = useState(null);

  useEffect(() => {
    const socket = connectSocket();

    // Join user room if userId provided
    if (userId) {
      socket.emit('joinUser', userId);
      console.log('Joined user room:', userId);
    }

    // Listen for new tasks
    socket.on('task:new', (data) => {
      console.log('📥 New task received:', data);
      setNewTask(data.task);
      // Add to tasks list
      setTasks((prevTasks) => {
        // Check if task already exists (prevent duplicates)
        const exists = prevTasks.some(t => t._id === data.taskId);
        if (!exists) {
          return [data.task, ...prevTasks];
        }
        return prevTasks;
      });
    });

    // Listen for task updates
    socket.on('task:updated', (data) => {
      console.log('📥 Task updated:', data);
      setUpdatedTask(data.task);
      // Update task in list
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task._id === data.taskId ? { ...task, ...data.task } : task
        )
      );
    });

    // Listen for task assigned to current user
    if (userId) {
      socket.on('task:assigned', (data) => {
        console.log('📥 Task assigned to you:', data);
        setNewTask(data.task);
        setTasks((prevTasks) => {
          const exists = prevTasks.some(t => t._id === data.taskId);
          if (!exists) {
            return [data.task, ...prevTasks];
          }
          return prevTasks;
        });
      });
    }

    // Cleanup on unmount
    return () => {
      socket.off('task:new');
      socket.off('task:updated');
      socket.off('task:assigned');
      if (userId) {
        socket.emit('leaveUser', userId);
      }
    };
  }, [userId]);

  return { tasks, newTask, updatedTask, setTasks };
};
```

### Step 4: Use in Task List Component

Example: `src/components/TaskList.js`

```javascript
import React, { useEffect, useState } from 'react';
import { useTaskSocket } from '../hooks/useTaskSocket';
import { connectSocket } from '../utils/socket';

const TaskList = ({ currentUserId }) => {
  const { tasks, newTask, updatedTask, setTasks } = useTaskSocket(currentUserId);
  const [loading, setLoading] = useState(true);

  // Initial fetch of tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/addtaskassign');
        const result = await response.json();
        if (result.success) {
          setTasks(result.data);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [setTasks]);

  // Show notification when new task arrives
  useEffect(() => {
    if (newTask) {
      // Show toast notification
      console.log('New task:', newTask);
      // You can use a toast library here
      // toast.success(`New task: ${newTask.taskName}`);
    }
  }, [newTask]);

  // Show notification when task is updated
  useEffect(() => {
    if (updatedTask) {
      console.log('Task updated:', updatedTask);
      // toast.info(`Task updated: ${updatedTask.taskName}`);
    }
  }, [updatedTask]);

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div>
      <h2>Tasks</h2>
      {tasks.length === 0 ? (
        <p>No tasks found</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task._id}>
              <h3>{task.taskName}</h3>
              <p>Status: {task.taskStatus}</p>
              <p>Assigned to: {task.receiverUserId}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TaskList;
```

### Step 5: Use in Task Detail Component

Example: `src/components/TaskDetail.js`

```javascript
import React, { useEffect, useState } from 'react';
import { connectSocket, getSocket } from '../utils/socket';

const TaskDetail = ({ taskId }) => {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const socket = connectSocket();

    // Join task-specific room
    socket.emit('joinTask', taskId);

    // Fetch initial task data
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/addtaskassign/${taskId}`);
        const result = await response.json();
        if (result.success) {
          setTask(result.data);
        }
      } catch (error) {
        console.error('Error fetching task:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();

    // Listen for task updates in this specific task room
    socket.on('task:statusUpdated', (data) => {
      if (data.taskId === taskId) {
        console.log('Task status updated:', data);
        setTask(data.task);
        // Show notification
        // toast.info(`Task status changed to ${data.taskStatus}`);
      }
    });

    // Cleanup
    return () => {
      socket.off('task:statusUpdated');
      socket.emit('leave-task-room', { taskId });
    };
  }, [taskId]);

  if (loading) {
    return <div>Loading task...</div>;
  }

  if (!task) {
    return <div>Task not found</div>;
  }

  return (
    <div>
      <h2>{task.taskName}</h2>
      <p>Status: {task.taskStatus}</p>
      <p>Priority: {task.priority}</p>
      {/* Rest of task details */}
    </div>
  );
};

export default TaskDetail;
```

### Step 6: Initialize Socket in App Component

In your main `App.js` or `index.js`:

```javascript
import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from './utils/socket';

function App() {
  useEffect(() => {
    // Connect socket when app loads
    connectSocket();

    // Disconnect on unmount
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    // Your app components
  );
}
```

---

## Complete Example: Task Management with Real-Time Updates

```javascript
// src/components/TaskManager.js
import React, { useState, useEffect } from 'react';
import { useTaskSocket } from '../hooks/useTaskSocket';
import { connectSocket } from '../utils/socket';

const TaskManager = ({ userId }) => {
  const { tasks, newTask, updatedTask, setTasks } = useTaskSocket(userId);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Initialize socket connection
  useEffect(() => {
    connectSocket();
  }, []);

  // Show notification for new tasks
  useEffect(() => {
    if (newTask) {
      setNotificationMessage(`New task: ${newTask.taskName}`);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    }
  }, [newTask]);

  // Show notification for updated tasks
  useEffect(() => {
    if (updatedTask) {
      setNotificationMessage(`Task updated: ${updatedTask.taskName}`);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    }
  }, [updatedTask]);

  // Create new task function
  const createTask = async (taskData) => {
    try {
      const response = await fetch('/api/addtaskassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const result = await response.json();
      if (result.success) {
        // Task will be added via socket automatically
        console.log('Task created:', result.data);
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  return (
    <div>
      {showNotification && (
        <div className="notification">
          {notificationMessage}
        </div>
      )}
      
      <h1>Tasks</h1>
      <div>
        {tasks.map((task) => (
          <div key={task._id} className="task-card">
            <h3>{task.taskName}</h3>
            <p>Status: {task.taskStatus}</p>
            <p>Priority: {task.priority}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskManager;
```

---

## Key Points

1. **Socket Connection**: Connect once when app loads, reuse the connection
2. **Room Joining**: Join user rooms to receive user-specific updates
3. **Event Listeners**: Listen for `task:new`, `task:updated`, `task:assigned` events
4. **State Management**: Update your task list state when socket events arrive
5. **Duplicate Prevention**: Check if task already exists before adding
6. **Cleanup**: Remove event listeners and leave rooms on component unmount

---

## Testing

1. Open two browser windows/tabs
2. Create a task in one window
3. The task should appear in the other window automatically
4. Update task status in one window
5. Status should update in real-time in the other window

---

## Troubleshooting

- **Socket not connecting**: Check backend URL and CORS settings
- **Events not received**: Verify you're joining the correct rooms
- **Duplicate tasks**: Add duplicate check in your state update logic
- **Performance issues**: Debounce state updates if needed

---

## Environment Variables

Add to your `.env` file:

```
REACT_APP_API_URL=http://localhost:3000
# or for production
REACT_APP_API_URL=https://your-backend-url.com
```

