const path = require('path');
const assert = require('assert');

// Mock Data
const mockUsers = [
    { userId: 'user1', firstName: 'John', lastName: 'Doe', role: 'Developer', position: 'Senior' },
    { userId: 'user2', firstName: 'Jane', lastName: 'Smith', role: 'Manager', position: 'Lead' }
];

const mockUserDocs = {
    'user1': { userId: 'user1', blissSalary: 50000, beforeBlissSalary: 40000 },
    'user2': { userId: 'user2', blissSalary: null } // Should be skipped
};

const mockAttendance = {
    'user1': { CheckInCheckOutTime: [] }
};

const mockLeaves = {
    'user1': { months: [] }
};

// Mock Models
const mockUserDetailsModel = {
    find: () => ({ select: () => Promise.resolve(mockUsers) })
};

const mockUserVerificationDocumentsModel = {
    findOne: ({ userId }) => Promise.resolve(mockUserDocs[userId]),
    find: () => Promise.resolve([]) // Not used in new logic but kept for safety
};

const mockCheckInCheckOutModel = {
    findOne: ({ userId }) => Promise.resolve(mockAttendance[userId])
};

const mockUserLeavesModel = {
    findOne: ({ userId }) => Promise.resolve(mockLeaves[userId])
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

// Register Mocks - IMPORTANT to use absolute paths or correct relative paths that the controller uses
try {
    const baseDir = path.resolve(__dirname, '..');

    mockRequire(path.join(baseDir, 'UserVerificationDocuments/UserVerificationDocumentsSchema/UserVerificationDocumentsSchema.js'), mockUserVerificationDocumentsModel);
    mockRequire(path.join(baseDir, 'CheckInCheckOutApi/CheckInCheckOutSchema/CheckInCheckOutSchema.js'), mockCheckInCheckOutModel);
    mockRequire(path.join(baseDir, 'LeavesApi/LeavesSchema/LeavesSchema.js'), mockUserLeavesModel);
    mockRequire(path.join(baseDir, 'UserDetails/UserDetailsSchema/UserDetailsSchema.js'), mockUserDetailsModel);

    // Load Controller
    const controller = require('./SalaryCalculationController');

    // Test Runner
    (async () => {
        console.log("Starting verification...");

        const req = {
            query: { month: '12', year: '2025' }
        };

        let responseData = null;
        const res = {
            status: (code) => ({
                json: (data) => {
                    console.log(`Response Status: ${code}`);
                    responseData = data;
                }
            })
        };

        const next = (err) => {
            console.error("Error in controller:", err);
        };

        await controller.calculateAllUsersSalary(req, res, next);

        console.log("Response Data:", JSON.stringify(responseData, null, 2));

        // Assertions
        assert.strictEqual(responseData.success, true, "Success should be true");
        assert.strictEqual(responseData.data.length, 2, "Should have 2 results (user1 and user2)");

        // User 1 Check
        const user1 = responseData.data.find(u => u.userId === 'user1');
        assert.ok(user1, "User1 should be present");
        assert.strictEqual(user1.currentSalary, 50000);

        // User 2 Check (No Salary)
        const user2 = responseData.data.find(u => u.userId === 'user2');
        assert.ok(user2, "User2 should be present even without salary");
        assert.strictEqual(user2.currentSalary, 0, "User2 salary should be 0");
        assert.strictEqual(user2.salaryData.baseMonthlySalary, 0, "Base salary in calculation should be 0");

        console.log("Verification Successful!");
    })();

} catch (err) {
    console.error("Verification Setup Failed:", err);
}
