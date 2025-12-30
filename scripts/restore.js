const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupDir = path.join(__dirname, '../database_backup');

async function restore() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('Error: MONGODB_URI not found in .env');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully.');

        if (!fs.existsSync(backupDir)) {
            console.error(`Backup directory not found: ${backupDir}`);
            process.exit(1);
        }

        const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json'));
        console.log(`Found ${files.length} backup files.`);

        for (const file of files) {
            const collectionName = file.replace('.json', '');
            const filePath = path.join(backupDir, file);

            console.log(`\nRestoring collection: ${collectionName}...`);

            const rawData = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(rawData);

            if (data.length === 0) {
                console.log(`Skipping empty collection: ${collectionName}`);
                continue;
            }

            // Convert date strings back to Date objects if they look like ISO dates
            const processedData = data.map(doc => {
                const newDoc = { ...doc };
                for (const key in newDoc) {
                    if (typeof newDoc[key] === 'string' &&
                        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(newDoc[key])) {
                        newDoc[key] = new Date(newDoc[key]);
                    }
                }
                return newDoc;
            });

            // Clear existing data (CAUTION: This deletes existing data in the collection)
            console.log(`Clearing existing data from ${collectionName}...`);
            await mongoose.connection.db.collection(collectionName).deleteMany({});

            // Insert backup data
            console.log(`Inserting ${processedData.length} documents...`);
            await mongoose.connection.db.collection(collectionName).insertMany(processedData);

            console.log(`Successfully restored ${collectionName}.`);
        }

        console.log('\nRestoration completed successfully!');

    } catch (error) {
        console.error('Restoration failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Warning message
console.log('WARNING: This script will OVERWRITE existing data in your database.');
console.log('Type "yes" to continue:');

process.stdin.once('data', (data) => {
    if (data.toString().trim().toLowerCase() === 'yes') {
        restore();
    } else {
        console.log('Restoration cancelled.');
        process.exit(0);
    }
});
