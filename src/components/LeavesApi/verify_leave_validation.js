const path = require('path');
const assert = require('assert');

// Mock Data
const mockUserDetails = {
    'hr1': { userId: 'hr1', role: 'HR' },
    'user1': { userId: 'user1', role: 'Developer' }
};

// Mock Models
const mockUserLeavesModel = {
    findOne: ({ userId }) => Promise.resolve(null),
    save: function () { return Promise.resolve(this); }
};

const mockUserDetailsModel = {
    findOne: ({ userId }) => Promise.resolve(mockUserDetails[userId])
};

// Helper to mock require
const mockRequire = (id, mock) => {
    const resolved = require.resolve(id);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: mock
    };
};

try {
    const baseDir = path.resolve(__dirname, '../../');

    // Mock dependencies
    mockRequire(path.join(baseDir, 'middleware/redisCache.js'), { invalidateCache: () => Promise.resolve() });
    mockRequire(path.join(baseDir, 'utils/socket.js'), { getIO: () => null });
    mockRequire(path.join(baseDir, 'components/LeavesApi/LeavesSchema/LeavesSchema.js'), function (data) {
        this.userId = data.userId;
        this.months = data.months;
        this.save = () => Promise.resolve(this);
    });
    const Model = require(path.join(baseDir, 'components/LeavesApi/LeavesSchema/LeavesSchema.js'));
    Model.findOne = ({ userId }) => Promise.resolve(null);

    mockRequire(path.join(baseDir, 'components/UserDetails/UserDetailsSchema/UserDetailsSchema.js'), mockUserDetailsModel);

    // Load Controller
    const controller = require('./LeavesController');

    // Test Runner
    (async () => {
        console.log("🚀 Starting Refined Leave Validation Verification (including isHRLeave)...");

        const runTest = async (testName, body, expectedStatus, expectedMessagePart) => {
            console.log(`\nTesting: ${testName}`);
            const req = { body };
            let capturedStatus = null;
            let capturedData = null;

            const res = {
                status: (code) => {
                    capturedStatus = code;
                    return {
                        json: (data) => {
                            capturedData = data;
                        }
                    };
                }
            };
            const next = (err) => console.error("Error:", err);

            await controller.request(req, res, next);

            try {
                assert.strictEqual(capturedStatus, expectedStatus, `Expected status ${expectedStatus}, got ${capturedStatus}`);
                if (expectedStatus !== 201) {
                    assert.strictEqual(capturedData.success, false);
                    assert.ok(capturedData.message.includes(expectedMessagePart), `Expected message to include "${expectedMessagePart}", got "${capturedData.message}"`);
                } else {
                    assert.strictEqual(capturedData.success, true);
                }
                console.log(`✅ ${testName} Passed`);
            } catch (err) {
                console.error(`❌ ${testName} Failed: ${err.message}`);
                console.log("Captured Data:", JSON.stringify(capturedData, null, 2));
                process.exit(1);
            }
        };

        // 1. Regular User - 3rd Friday (Should Fail)
        // Jan 16 is 3rd Friday of 2026 Jan
        await runTest("Regular User - Restricted 3rd Friday (Jan 16)", {
            userId: "user1",
            month: "JAN",
            role: "user",
            leaves: [{ startDate: "2026-01-16", endDate: "2026-01-16" }]
        }, 400, "restricted days");

        // 2. HR User via 'isHRLeave: true' (Should Pass)
        await runTest("User - Bypass via isHRLeave: true", {
            userId: "user1",
            month: "JAN",
            isHRLeave: true,
            leaves: [{ startDate: "2026-01-16", endDate: "2026-01-16" }]
        }, 201);

        // 3. HR User via 'role: HR' (Should Pass)
        await runTest("HR User - Bypass via role: HR", {
            userId: "user1",
            month: "JAN",
            role: "HR",
            leaves: [{ startDate: "2026-01-16", endDate: "2026-01-16" }]
        }, 201);

        // 4. HR User via 'requesterRole: HR' (Should Pass)
        await runTest("HR User - Bypass via requesterRole: HR", {
            userId: "user1",
            month: "JAN",
            requesterRole: "HR",
            leaves: [{ startDate: "2026-01-16", endDate: "2026-01-16" }]
        }, 201);

        // 5. HR User via 'requesterId' (Should Pass)
        await runTest("HR User - Bypass via requesterId", {
            userId: "user1",
            month: "JAN",
            requesterId: "hr1",
            leaves: [{ startDate: "2026-01-16", endDate: "2026-01-16" }]
        }, 201);

        console.log("\n🎉 All refined verifications completed successfully!");
        process.exit(0);
    })();

} catch (err) {
    console.error("Verification Setup Failed:", err);
    process.exit(1);
}
