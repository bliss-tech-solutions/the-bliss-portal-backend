const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserScheduleSchema = new Schema(
    {
        userId: { type: String, required: true },
        taskId: { type: Schema.Types.ObjectId, ref: 'AddTaskAssign', required: true },
        slotId: { type: Schema.Types.ObjectId, required: true },
        start: { type: Date, required: true },
        end: { type: Date, required: true },
        status: {
            type: String,
            enum: ['scheduled', 'active', 'completed', 'expired', 'cancelled'],
            default: 'scheduled'
        },
        taskStatus: {
            type: String,
            enum: ['pending', 'in_progress', 'completed', 'cancelled'],
            default: 'pending'
        }
    },
    {
        timestamps: true,
        collection: 'userSchedules'
    }
);

UserScheduleSchema.index({ userId: 1, start: 1 });
UserScheduleSchema.index({ userId: 1, taskId: 1, slotId: 1 }, { unique: true });

const UserScheduleModel = mongoose.model('UserSchedule', UserScheduleSchema);

module.exports = UserScheduleModel;

