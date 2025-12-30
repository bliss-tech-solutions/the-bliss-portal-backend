
// MOCK MODELS
const UserVerificationDocumentsModel = {
    find: (query) => ({
        select: async (fields) => [
            { userId: 'test-user-1', name: 'Alice', department: 'Eng', position: 'Dev', blissSalary: 50000 },
            { userId: 'test-user-2', name: 'Bob', department: 'HR', position: 'Manager', blissSalary: 60000 }
        ]
    })
};
const CheckInCheckOutModel = {
    findOne: async () => ({ CheckInCheckOutTime: [] })
};
const UserLeavesModel = {
    findOne: async () => ({ months: [] })
};

// MOCK EXPRESS RESPONSES
const req = {
    query: { year: '2025', month: '10' }
};
const res = {
    status: (code) => ({
        json: (data) => {
            console.log(`STATUS: ${code}`);
            console.log(JSON.stringify(data, null, 2));
            return data;
        }
    })
};
const next = (err) => console.error(err);

// --- PASTE CONTROLLER CODE HERE (modified to remove requires) ---

const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// inclusive date difference
const diffInclusiveDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

// ---------------- WORKED DAYS (DISPLAY ONLY) ----------------
const getWorkedDays = (attendanceDoc, month, year) => {
    let workedDays = 0;
    if (!attendanceDoc?.CheckInCheckOutTime?.length) return 0;

    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;

    for (const entry of attendanceDoc.CheckInCheckOutTime) {
        if (!entry?.date?.startsWith(targetMonth)) continue;
        if (entry.DayStatus === 'FULL') workedDays += 1;
        if (entry.DayStatus === 'HALF') workedDays += 0.5;
    }

    return workedDays;
};

// ---------------- ATTENDANCE HALF DAY DEDUCTION ----------------
const getAttendanceHalfDayDeduction = (attendanceDoc, month, year) => {
    let halfDaysCount = 0;

    if (!attendanceDoc?.CheckInCheckOutTime?.length) {
        return { halfDaysCount: 0, halfDayDeductionDays: 0 };
    }

    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;

    for (const entry of attendanceDoc.CheckInCheckOutTime) {
        if (!entry?.date?.startsWith(targetMonth)) continue;
        if (entry.DayStatus === 'HALF') halfDaysCount += 1;
    }

    return {
        halfDaysCount,
        halfDayDeductionDays: halfDaysCount * 0.5
    };
};

// ---------------- LEAVE DEDUCTION ----------------
const getLeaveDeduction = (leavesDoc, targetMonthName) => {
    let fullDayLeaves = 0;
    let halfDayLeaves = 0;

    if (!leavesDoc?.months?.length) {
        return { fullDayLeaves: 0, halfDayLeaves: 0, totalLeaveDays: 0 };
    }

    const monthBlock = leavesDoc.months.find(m => m.month === targetMonthName);
    if (!monthBlock?.leaves?.length) {
        return { fullDayLeaves: 0, halfDayLeaves: 0, totalLeaveDays: 0 };
    }

    for (const leave of monthBlock.leaves) {
        if (!['approved', 'partially_approved'].includes(leave.status)) continue;

        const isHalfDay =
            leave?.isHalfDay === true ||
            leave?.dayType === 'HALF' ||
            leave?.leaveType === 'HALF' ||
            leave?.type === 'HALF';

        // APPROVED
        if (leave.status === 'approved') {
            if (isHalfDay) {
                halfDayLeaves += 1;
            } else {
                fullDayLeaves += diffInclusiveDays(leave.startDate, leave.endDate);
            }
        }

        // PARTIALLY APPROVED
        if (leave.status === 'partially_approved' && Array.isArray(leave.approvedDates)) {
            for (const d of leave.approvedDates) {
                if (typeof d === 'object' && (d.type === 'HALF' || d.dayType === 'HALF')) {
                    halfDayLeaves += 1;
                } else {
                    fullDayLeaves += 1;
                }
            }
        }
    }

    const totalLeaveDays = fullDayLeaves + (halfDayLeaves * 0.5);
    return { fullDayLeaves, halfDayLeaves, totalLeaveDays };
};

// ---------------- MAIN CALCULATION ----------------
const calculateForMonth = async (userId, month, year, userDocs, attendanceDoc, leavesDoc) => {
    const baseSalary = Number(userDocs.blissSalary);
    const monthName = monthNames[month - 1];
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    const perDayExact = baseSalary / totalDaysInMonth;
    const perDaySalary = round2(perDayExact);

    const workedDays = getWorkedDays(attendanceDoc, month, year);

    // 1️⃣ PF FIRST (FULL SALARY)
    const pfPercentage = 10;
    const pfAmount = round2((baseSalary * pfPercentage) / 100);
    const salaryAfterPF = round2(baseSalary - pfAmount);

    // 2️⃣ LEAVE DEDUCTION
    const { fullDayLeaves, halfDayLeaves, totalLeaveDays } =
        getLeaveDeduction(leavesDoc, monthName);
    const leaveDeductionAmount = round2(totalLeaveDays * perDayExact);

    // 3️⃣ ATTENDANCE HALF DAY
    const { halfDaysCount, halfDayDeductionDays } =
        getAttendanceHalfDayDeduction(attendanceDoc, month, year);
    const attendanceHalfDayDeductionAmount =
        round2(halfDayDeductionDays * perDayExact);

    // 4️⃣ FINAL NET SALARY
    const totalDeductionAmount =
        round2(leaveDeductionAmount + attendanceHalfDayDeductionAmount);

    const netSalaryPayable =
        round2(salaryAfterPF - totalDeductionAmount);

    return {
        month,
        monthName,
        year,
        totalDaysInMonth,

        baseMonthlySalary: round2(baseSalary),

        salaryRate: {
            perDaySalary,
            calculation: `${baseSalary} ÷ ${totalDaysInMonth} days`
        },

        attendanceSummary: {
            workedDays,

            providentFund: {
                pfPercentage,
                pfAmount,
                calculation: `${pfPercentage}% of ${baseSalary}`
            },

            leaveDeduction: {
                fullDayLeaves,
                halfDayLeaves,
                totalLeaveDays,
                leaveDeductionAmount,
                calculation: `${totalLeaveDays} × ${perDaySalary}`
            },

            checkInCheckOutHalfDay: {
                halfDaysCount,
                halfDayDeductionDays,
                deductionAmount: attendanceHalfDayDeductionAmount,
                calculation: `${halfDayDeductionDays} × ${perDaySalary}`
            },

            totalDeduction: {
                totalDeductionAmount,
                calculation: `PF + Leave + Half Day`
            }
        },

        earnings: {
            salaryAfterPF,
            calculation: `${baseSalary} − ${pfAmount}`
        },

        finalPay: {
            netSalaryPayable,
            finalCalculation: `${salaryAfterPF} − ${totalDeductionAmount}`,
            paymentStatus: netSalaryPayable > 0 ? "Salary payable" : "No salary payable"
        }
    };
};

const salaryCalculationController = {
    calculateAllUsersSalary: async (req, res, next) => {
        try {
            const month = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
            const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

            // 1. Fetch eligible users (must have blissSalary)
            const users = await UserVerificationDocumentsModel.find({
                blissSalary: { $exists: true, $ne: null }
            }).select('userId name department designation blissSalary');

            if (!users || users.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }

            const results = [];

            // 2. Iterate and Calculate
            for (const user of users) {
                const attendanceDoc = await CheckInCheckOutModel.findOne({ userId: user.userId });
                const leavesDoc = await UserLeavesModel.findOne({ userId: user.userId });

                // We can reuse calculateForMonth logic, passing proper userDocs structure
                // created on the fly or just passing the mongoose doc if it matches expected fields
                const calculation = await calculateForMonth(
                    user.userId,
                    month,
                    year,
                    user, // This acts as userDocs (has blissSalary)
                    attendanceDoc,
                    leavesDoc
                );

                results.push({
                    userId: user.userId,
                    name: user.name,
                    department: user.department, // Assuming these fields exist in schema
                    designation: user.position,  // Schema has 'position', mapping to designation if needed or just use position
                    salaryData: calculation
                });
            }

            return res.status(200).json({
                success: true,
                count: results.length,
                month,
                year,
                data: results
            });

        } catch (error) {
            next(error);
        }
    }
};

// --- RUN TEST ---
console.log("Running calculateAllUsersSalary...");
salaryCalculationController.calculateAllUsersSalary(req, res, next);
