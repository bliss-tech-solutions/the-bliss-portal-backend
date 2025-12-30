const mongoose = require('mongoose');
const AddTaskAssignModel = require('./src/components/AddTaskAssign/AddTaskAssignSchema/AddTaskAssignSchema');
const UserScheduleModel = require('./src/components/UserSchedule/UserScheduleSchema');
const addTaskAssignController = require('./src/components/AddTaskAssign/AddTaskAssignController');

// Mock req/res for testing
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.body = data;
        return res;
    };
    return res;
};

async function verify() {
    try {
        await mongoose.connect('mongodb://localhost:27017/bliss-portal'); // Adjust if needed
        console.log('Connected to DB');

        const userId = 'test-user-creator';
        const receiverUserId = 'test-user-receiver';
        const date = '2025-12-31';
        const start = `${date}T10:00:00.000Z`;
        const end = `${date}T12:00:00.000Z`;

        // 1. Create a task
        console.log('Step 1: Creating task...');
        const req1 = {
            body: {
                userId,
                receiverUserId,
                taskName: 'Original Task',
                slots: [{ start, end, slotDate: date }]
            }
        };
        const res1 = mockRes();
        await addTaskAssignController.create(req1, res1, (e) => console.error(e));

        if (res1.statusCode !== 201) {
            console.error('Failed to create task:', res1.body);
            return;
        }
        const taskId = res1.body.data._id;
        console.log('Task created:', taskId);

        // 2. Mark as Completed (Capital C)
        console.log('Step 2: Marking as Completed...');
        // We'll bypass the controller's validation for a second to simulate "Completed" in DB direct or via bypass
        await AddTaskAssignModel.findByIdAndUpdate(taskId, { taskStatus: 'Completed', 'slots.0.status': 'Completed' });
        const updatedTask = await AddTaskAssignModel.findById(taskId);
        console.log('Status updated to:', updatedTask.taskStatus);

        // Sync manually since we bypassed controller
        const syncTaskSchedule = require('./src/components/AddTaskAssign/AddTaskAssignController').syncTaskSchedule;
        // Wait, syncTaskSchedule is not exported, but it's called by the controller.
        // Let's use the controller's updateStatus if it allowed "Completed", but it doesn't.
        // So we'll update UserSchedule directly to simulate the issue.
        await UserScheduleModel.updateMany({ taskId }, { taskStatus: 'Completed', status: 'Completed' });

        // 3. Try to book the same slot
        console.log('Step 3: Attempting to book the same slot...');
        const req2 = {
            body: {
                userId,
                receiverUserId,
                taskName: 'New Task',
                slots: [{ start, end, slotDate: date }]
            }
        };
        const res2 = mockRes();
        await addTaskAssignController.create(req2, res2, (e) => console.error(e));

        if (res2.statusCode === 201) {
            console.log('SUCCESS: Slot was released for new booking!');
        } else {
            console.error('FAILURE: Slot was NOT released:', res2.body);
        }

        // Cleanup
        await AddTaskAssignModel.deleteMany({ _id: { $in: [taskId, res2.body?.data?._id] } });
        await UserScheduleModel.deleteMany({ taskId: { $in: [taskId, res2.body?.data?._id] } });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Verification failed:', error);
    }
}

// verify();
console.log('Verification script created. Note: Requires local DB connection.');
