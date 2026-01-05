const mongoose = require('mongoose');
const DailyWorking = require('./src/components/DailyWorking/DailyWorkingSchema/DailyWorkingSchema');

// Mock next for controller testing
const next = (err) => { if (err) console.error('Error:', err); };

async function verifyRefactor() {
    try {
        console.log('Connecting to MongoDB...');
        // Replace with your MongoDB connection string if needed, or assume it's set in env
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bliss-portal-backend-test');
        console.log('Connected.');

        const DailyWorkingController = require('./src/components/DailyWorking/DailyWorkingController');

        const userId = 'test-user-' + Date.now();
        const date = new Date().toISOString();

        console.log('\n--- 1. Testing Create Task ---');
        const req1 = {
            body: {
                userId,
                title: 'Test Task 1',
                priority: 'High',
                date
            }
        };
        const res1 = {
            status: function (s) { this.statusCode = s; return this; },
            json: function (j) { this.data = j; return this; }
        };

        await DailyWorkingController.createTask(req1, res1, next);
        console.log('Task 1 created. Doc status:', res1.statusCode);
        const taskId1 = res1.data.newTask._id;

        const req2 = {
            body: {
                userId,
                title: 'Test Task 2',
                priority: 'Low',
                date
            }
        };
        const res2 = {
            status: function (s) { this.statusCode = s; return this; },
            json: function (j) { this.data = j; return this; }
        };

        await DailyWorkingController.createTask(req2, res2, next);
        console.log('Task 2 created. Doc status:', res2.statusCode);

        const checkDoc = await DailyWorking.findOne({ userId });
        console.log('Number of tasks in doc:', checkDoc.tasks.length);
        if (checkDoc.tasks.length === 2) {
            console.log('SUCCESS: Groups tasks correctly.');
        } else {
            console.error('FAILURE: Tasks not grouped correctly.');
        }

        console.log('\n--- 2. Testing Update Task ---');
        const reqUpdate = {
            params: { taskId: taskId1 },
            body: { title: 'Updated Title' }
        };
        const resUpdate = {
            status: function (s) { this.statusCode = s; return this; },
            json: function (j) { this.data = j; return this; }
        };

        await DailyWorkingController.updateTask(reqUpdate, resUpdate, next);
        console.log('Update status:', resUpdate.statusCode);
        console.log('Updated task title:', resUpdate.data.data.title);

        console.log('\n--- 3. Testing Get User Tasks ---');
        const reqGet = { params: { userId } };
        const resGet = {
            status: function (s) { this.statusCode = s; return this; },
            json: function (j) { this.data = j; return this; }
        };
        await DailyWorkingController.getUserTasks(reqGet, resGet, next);
        console.log('Get User Tasks count:', resGet.data.data.length);

        console.log('\n--- 4. Testing Delete Task ---');
        const reqDelete = { params: { taskId: taskId1 } };
        const resDelete = {
            status: function (s) { this.statusCode = s; return this; },
            json: function (j) { this.data = j; return this; }
        };
        await DailyWorkingController.deleteTask(reqDelete, resDelete, next);
        console.log('Delete status:', resDelete.statusCode);

        const finalDoc = await DailyWorking.findOne({ userId });
        console.log('Number of tasks after deletion:', finalDoc.tasks.length);
        if (finalDoc.tasks.length === 1) {
            console.log('SUCCESS: Task deleted correctly from array.');
        } else {
            console.error('FAILURE: Task not deleted correctly.');
        }

        // Cleanup
        await DailyWorking.deleteOne({ userId });
        console.log('\nTest data cleaned up.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyRefactor();
