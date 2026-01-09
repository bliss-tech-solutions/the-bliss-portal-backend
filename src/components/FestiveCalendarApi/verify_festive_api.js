const path = require('path');
const assert = require('assert');

// Mock Models
const mockFestiveCalendarModel = {
    findOneAndUpdate: function (query, update, options) {
        this.lastQuery = query;
        this.lastUpdate = update;
        return Promise.resolve({ _id: 'mockId', ...query, notes: [] });
    },
    findOne: function (query) {
        this.lastQuery = query;
        if (this.shouldReturnNull) return Promise.resolve(null);
        return Promise.resolve({
            _id: 'mockDocId',
            date: query.date,
            notes: this.mockNotes || [],
            save: function () { return Promise.resolve(this); }
        });
    }
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
    mockRequire(path.join(baseDir, 'components/FestiveCalendarApi/FestiveCalendarSchema/FestiveCalendarSchema.js'), mockFestiveCalendarModel);
    mockRequire(path.join(baseDir, 'utils/socket.js'), { getIO: () => null });

    const controller = require('./FestiveCalendarController');

    (async () => {
        console.log("🚀 Starting Festive Calendar API Verification...");

        const runTest = async (testName, method, params, body, expectedStatus) => {
            console.log(`\nTesting: ${testName}`);
            const req = { params, body, query: params };
            let capturedStatus = null;
            let capturedData = null;

            const res = {
                status: (code) => {
                    capturedStatus = code;
                    return { json: (data) => { capturedData = data; } };
                }
            };
            const next = (err) => console.error("Error:", err);

            await controller[method](req, res, next);

            try {
                assert.strictEqual(capturedStatus, expectedStatus, `Expected status ${expectedStatus}, got ${capturedStatus}`);
                console.log(`✅ ${testName} Passed`);
            } catch (err) {
                console.error(`❌ ${testName} Failed: ${err.message}`);
                console.log("Captured Data:", JSON.stringify(capturedData, null, 2));
                process.exit(1);
            }
        };

        // 1. ADD NOTE
        await runTest("Add Note with Event Type", "addNote", {}, { date: "2026-01-08", note: "Test Note", eventType: "Task (Green)" }, 201);

        // 2. UPDATE NOTE
        mockFestiveCalendarModel.mockNotes = [{ _id: "note123", note: "Old Note", eventType: "Task (Green)" }];
        await runTest("Update Note with Event Type", "updatedFestiveTask", {}, { date: "2026-01-08", noteId: "note123", note: "Updated Note", eventType: "Meeting (Red)" }, 200);

        // 3. DELETE NOTE
        mockFestiveCalendarModel.mockNotes = [{ _id: "note123", note: "To Be Deleted" }];
        await runTest("Delete Note", "deleteNote", { date: "2026-01-08", noteId: "note123" }, {}, 200);

        // 4. DELETE NON-EXISTENT NOTE
        mockFestiveCalendarModel.mockNotes = [{ _id: "otherId", note: "Stay" }];
        await runTest("Delete Non-existent Note", "deleteNote", { date: "2026-01-08", noteId: "note123" }, {}, 404);

        console.log("\n🎉 All Festive Calendar API verifications completed successfully!");
        process.exit(0);
    })();

} catch (err) {
    console.error("Verification Setup Failed:", err);
    process.exit(1);
}
