const mongoose = require('mongoose');
require('dotenv').config();

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bliss-portal';

// Define Schemas inline to avoid path issues
const { Schema, Types } = mongoose;

const AddTaskAssignSchema = new Schema({
    slots: [{
        status: { type: String, default: 'scheduled' }
    }],
    taskStatus: { type: String, default: 'pending' },
    receiverUserId: { type: String }
}, { strict: false, collection: 'addTaskAssign' });

const UserScheduleSchema = new Schema({
    userId: { type: String },
    taskId: { type: Schema.Types.ObjectId },
    slotId: { type: Schema.Types.ObjectId },
    start: { type: Date },
    end: { type: Date },
    status: { type: String },
    taskStatus: { type: String }
}, { strict: false, collection: 'userSchedules' });

const AddTaskAssignModel = mongoose.model('AddTaskAssign', AddTaskAssignSchema);
const UserScheduleModel = mongoose.model('UserSchedule', UserScheduleSchema);

async function syncData() {
    try {
        await mongoose.connect(DB_URI);
        console.log('Connected to MongoDB');

        const tasks = await AddTaskAssignModel.find({});
        console.log(`Found ${tasks.length} tasks to sync.`);

        for (const task of tasks) {
            let updated = false;

            // 1. Sync slot status if task is completed
            if (task.taskStatus === 'completed') {
                if (task.slots && Array.isArray(task.slots)) {
                    task.slots.forEach(slot => {
                        if (slot.status !== 'completed') {
                            slot.status = 'completed';
                            updated = true;
                        }
                    });
                }
            }

            if (updated) {
                await task.save();
            }

            // 2. Sync UserSchedule
            if (task.slots && Array.isArray(task.slots)) {
                for (const slot of task.slots) {
                    if (slot._id) {
                        await UserScheduleModel.updateOne(
                            { taskId: task._id, slotId: slot._id },
                            {
                                $set: {
                                    status: slot.status || 'scheduled',
                                    taskStatus: task.taskStatus || 'pending'
                                }
                            }
                        );
                    }
                }
            }
        }

        console.log('✅ Data sync completed successfully!');
    } catch (error) {
        console.error('❌ Sync failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

syncData();
