const mongoose = require('mongoose');
const UserVerificationDocumentsModel = require('./src/components/UserVerificationDocuments/UserVerificationDocumentsSchema/UserVerificationDocumentsSchema');
const CheckInCheckOutModel = require('./src/components/CheckInCheckOutApi/CheckInCheckOutSchema/CheckInCheckOutSchema');
const UserLeavesModel = require('./src/components/LeavesApi/LeavesSchema/LeavesSchema');
const axios = require('axios');

const DB_URI = 'mongodb://localhost:27017/bliss-portal'; // Adjust if needed

async function testCalculation() {
    try {
        console.log('--- Starting Verification ---');

        // Note: This script assumes the server is running on localhost:5000
        const userId = 'dummy_worker_123';
        const month = 12;
        const year = 2025;

        const response = await axios.get(`http://localhost:5000/api/salaryCalculation/calculate/${userId}?month=${month}&year=${year}`);

        console.log('API Response:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            console.log('✅ Salary calculation API is working!');
        } else {
            console.log('❌ API returned failure');
        }

    } catch (error) {
        if (error.response) {
            console.error('API Error:', error.response.data);
            if (error.response.status === 404) {
                console.log('⚠️ User or data not found. This is expected if dummy data is missing.');
            }
        } else {
            console.error('Connection Error:', error.message);
        }
    }
}

testCalculation();
