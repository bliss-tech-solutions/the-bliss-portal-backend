const BASE_URL = 'http://localhost:3000/api';

async function testAPIs() {
    console.log('🚀 Starting API Verification Tests...\n');

    try {
        // 1. Test Attachment Link API
        console.log('--- Testing Attachment Link API ---');
        const clientsRes = await fetch(`${BASE_URL}/clientmanagement/getAllClientsData`);
        const clientsData = await clientsRes.json();

        if (clientsData.success && clientsData.data.length > 0) {
            const clientId = clientsData.data[0]._id;
            const year = '2026';
            const month = 'Feb';

            console.log(`Testing with clientId: ${clientId}, year: ${year}, month: ${month}`);

            const attachmentRes = await fetch(`${BASE_URL}/clientmanagement/attachment-link?clientId=${clientId}&year=${year}&month=${month}`);
            const attachmentData = await attachmentRes.json();
            console.log('✅ Attachment Link API Result:', attachmentData);
        } else {
            console.log('⚠️ No clients found to test Attachment Link API.');
        }
        console.log('\n');

        // 2. Test Forgot Password API
        console.log('--- Testing Forgot Password API ---');
        const email = 'test@example.com';
        const newPassword = 'newPassword123';

        const forgotPasswordRes = await fetch(`${BASE_URL}/realEstate/forgotPassword`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword })
        });
        const forgotPasswordData = await forgotPasswordRes.json();
        console.log('✅ Forgot Password API Result:', forgotPasswordData);

    } catch (error) {
        console.error('💥 Critical Error during verification:', error.message);
    }
}

testAPIs();
