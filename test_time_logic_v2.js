
const testTimeLogic = () => {
    const checkLogic = (utcDateString, expectedHour, expectedMinute) => {
        const now = new Date(utcDateString); // UTC time

        // Correct Logic: Just add fixed offset to absolute UTC time
        const utcTimestamp = now.getTime();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(utcTimestamp + istOffset);

        const hours = istDate.getUTCHours();
        const minutes = istDate.getUTCMinutes();

        console.log(`UTC: ${now.toISOString()} -> IST (Calc): ${hours}:${minutes}`);
        console.log(`Expected: ${expectedHour}:${expectedMinute}`);

        if (hours === expectedHour && minutes === expectedMinute) {
            console.log('✅ PASS');
        } else {
            console.log('❌ FAIL');
        }
    };

    consrole.log('--- Testing Correct Logic ---');
    // Case 1: 5:20 AM UTC -> 10:50 AM IST
    checkLogic('2026-01-01T05:20:00.000Z', 10, 50);

    // Case 2: 5:15 AM UTC -> 10:45 AM IST
    checkLogic('2026-01-01T05:15:00.000Z', 10, 45);

    // Case 3: 4:30 AM UTC -> 10:00 AM IST
    checkLogic('2026-01-01T04:30:00.000Z', 10, 0);
};

testTimeLogic();
