const mongoose = require('mongoose');
const { Schema } = mongoose;

const PositionConfigSchema = new Schema({
    blockMinutes: { type: Number, required: true },
    gapMinutes: { type: Number, required: true }
}, { _id: false });

const SlotConfigSchema = new Schema({
    officeStartHour: { type: Number, default: 11 }, // 11:00
    officeEndHour: { type: Number, default: 19 },   // 19:00
    lunchStartHour: { type: Number, default: 13 },  // 13:00 (or 13:20 depending on position) - lunch break start
    lunchStartMinutes: { type: Number, default: 20 }, // 20 minutes past lunchStartHour (for Graphics: 13:20, for Video: 13:00)
    lunchEndHour: { type: Number, default: 14 },    // 14:00 - lunch break end (14:50 means 14 hours 50 minutes = 14*60+50)
    lunchEndMinutes: { type: Number, default: 50 }, // 50 minutes past lunch EndHour (so 14:50)
    graphics: { type: PositionConfigSchema, default: () => ({ blockMinutes: 60, gapMinutes: 20 }) }, // Graphics Designer: 1 hour + 20 min gap
    video: { type: PositionConfigSchema, default: () => ({ blockMinutes: 120, gapMinutes: 20 }) }, // Video Editor: 2 hours + 20 min gap
    // dynamic positions map: key = normalized position name
    positions: { type: Map, of: PositionConfigSchema, default: new Map() }
}, {
    timestamps: true,
    collection: 'slotConfig'
});

// Single document collection
SlotConfigSchema.statics.getSingleton = async function () {
    let doc = await this.findOne();
    if (!doc) {
        doc = await this.create({});
    } else {
        // Ensure defaults are set if missing or outdated
        let needsUpdate = false;
        
        // Update graphics defaults if missing or using old values
        if (!doc.graphics || doc.graphics.blockMinutes !== 60 || doc.graphics.gapMinutes !== 20) {
            doc.graphics = { blockMinutes: 60, gapMinutes: 20 };
            needsUpdate = true;
        }
        
        // Update video defaults if missing or using old values
        if (!doc.video || doc.video.blockMinutes !== 120 || doc.video.gapMinutes !== 20) {
            doc.video = { blockMinutes: 120, gapMinutes: 20 };
            needsUpdate = true;
        }
        
        // Ensure office hours are set
        if (!doc.officeStartHour) {
            doc.officeStartHour = 11;
            needsUpdate = true;
        }
        if (!doc.officeEndHour) {
            doc.officeEndHour = 19;
            needsUpdate = true;
        }
        
        // Ensure lunch break is set
        if (doc.lunchStartHour === undefined || doc.lunchStartHour === null) {
            doc.lunchStartHour = 13;
            needsUpdate = true;
        }
        if (doc.lunchStartMinutes === undefined || doc.lunchStartMinutes === null) {
            doc.lunchStartMinutes = 20; // Default 13:20 for Graphics Designer
            needsUpdate = true;
        }
        if (doc.lunchEndHour === undefined || doc.lunchEndHour === null) {
            doc.lunchEndHour = 14;
            needsUpdate = true;
        }
        if (doc.lunchEndMinutes === undefined || doc.lunchEndMinutes === null) {
            doc.lunchEndMinutes = 50;
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            await doc.save();
        }
    }
    return doc;
};

const SlotConfigModel = mongoose.model('SlotConfig', SlotConfigSchema);
module.exports = SlotConfigModel;


