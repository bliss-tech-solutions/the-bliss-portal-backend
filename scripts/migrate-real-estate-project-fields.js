/**
 * One-time migration: Add floorPlanImages and projectSlideHeroImages to existing
 * realEstateProjects documents that don't have these fields.
 * Run: node scripts/migrate-real-estate-project-fields.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const RealEstateProjectModel = require('../src/components/RealEstate/RealEstateProject/RealEstateProjectSchema/RealEstateProjectSchema');

async function migrate() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('Error: MONGODB_URI not found in .env');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const resultFloor = await RealEstateProjectModel.updateMany(
            { floorPlanImages: { $exists: false } },
            { $set: { floorPlanImages: [] } }
        );
        const resultSlide = await RealEstateProjectModel.updateMany(
            { projectSlideHeroImages: { $exists: false } },
            { $set: { projectSlideHeroImages: [] } }
        );

        console.log('Migration done:');
        console.log('  - floorPlanImages added to', resultFloor.modifiedCount, 'documents');
        console.log('  - projectSlideHeroImages added to', resultSlide.modifiedCount, 'documents');

        await mongoose.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
