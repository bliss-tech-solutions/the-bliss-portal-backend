const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupDir = path.join(__dirname, '../database_backup');

async function backup() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('Error: MONGODB_URI not found in .env');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully.');

        // Create backup directory if it doesn't exist
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Get all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Found ${collections.length} collections.`);

        for (const collectionInfo of collections) {
            const collectionName = collectionInfo.name;
            console.log(`Backing up collection: ${collectionName}...`);

            const data = await mongoose.connection.db.collection(collectionName).find({}).toArray();

            const filePath = path.join(backupDir, `${collectionName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            console.log(`Saved ${data.length} documents to ${collectionName}.json`);
        }

        console.log('\nBackup completed successfully!');
        console.log(`All files are stored in: ${backupDir}`);

    } catch (error) {
        console.error('Backup failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

backup();
