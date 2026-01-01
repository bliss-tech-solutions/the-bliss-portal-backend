
const testTimeLogic = () => {
    // 1. Mock "Now" as if we are on a UTC server
    // Let's say it's 10:30 AM UTC, which is 4:00 PM IST (16:00) -> Late
    // Let's say it's 5:00 AM UTC, which is 10:30 AM IST -> On Time

    const checkLogic = (utcDateString, expectedHour, expectedMinute) => {
        const now = new Date(utcDateString); // UTC time

        // Logic from controller
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(utc + istOffset);

        const hours = istDate.getUTCHours();
        const minutes = istDate.getUTCMinutes();

        console.log(`UTC: ${now.toISOString()} -> IST: ${hours}:${minutes}`);
        console.log(`Expected: ${expectedHour}:${expectedMinute}`);

        if (hours === expectedHour && minutes === expectedMinute) {
            console.log('✅ PASS');
        } else {
            console.log('❌ FAIL');
        }
    };

    console.log('--- Testing Time Conversion ---');
    // Case 1: 5:20 AM UTC -> 10:50 AM IST
    checkLogic('2026-01-01T05:20:00.000Z', 10, 50);

    // Case 2: 5:15 AM UTC -> 10:45 AM IST
    checkLogic('2026-01-01T05:15:00.000Z', 10, 45);

    // Case 3: 4:30 AM UTC -> 10:00 AM IST
    checkLogic('2026-01-01T04:30:00.000Z', 10, 0);
};

testTimeLogic();
