const UserVerificationDocumentsModel = require('./UserVerificationDocumentsSchema/UserVerificationDocumentsSchema');

const userVerificationDocumentsController = {
    // GET /api/userverificationdocuments/getAll - Get all user verification documents
    getAll: async (req, res, next) => {
        try {
            const documents = await UserVerificationDocumentsModel.find();

            res.status(200).json({
                success: true,
                message: 'User verification documents retrieved successfully',
                data: documents,
                count: documents.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/userverificationdocuments/getByUserId/:userId - Get verification documents by userId
    getByUserId: async (req, res, next) => {
        try {
            const { userId } = req.params;

            const documents = await UserVerificationDocumentsModel.find({ userId });

            if (documents.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No verification documents found for this user'
                });
            }

            res.status(200).json({
                success: true,
                message: 'User verification documents retrieved successfully',
                data: documents,
                count: documents.length
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userverificationdocuments/create - Create new user verification document
    create: async (req, res, next) => {
        try {
            const {
                userId,
                name,
                department,
                position,
                jobType,
                beforeBlissSalary,
                blissSalary,
                joiningDate,
                currentAddress,
                permanentAddress,
                experience,
                bankDetails,
                aadharCardImage,
                passportPhoto,
                offerLetter
            } = req.body;

            // Validate required fields
            if (!userId || !name || !department || !position || !jobType || !joiningDate || !currentAddress || !permanentAddress) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: userId, name, department, position, jobType, joiningDate, currentAddress, and permanentAddress are required'
                });
            }

            // Check if document already exists for this userId
            const existingDocument = await UserVerificationDocumentsModel.findOne({ userId });
            if (existingDocument) {
                return res.status(400).json({
                    success: false,
                    message: 'Verification document already exists for this user. Use update endpoint to modify it.'
                });
            }

            // Create new document
            const newDocument = new UserVerificationDocumentsModel({
                userId,
                name,
                department,
                position,
                jobType,
                beforeBlissSalary: beforeBlissSalary ? Number(beforeBlissSalary) : undefined,
                blissSalary: blissSalary ? Number(blissSalary) : undefined,
                pfFund: blissSalary ? Math.round(Number(blissSalary) * 0.10) : undefined,
                joiningDate: new Date(joiningDate),
                currentAddress,
                permanentAddress,
                experience,
                bankDetails: bankDetails ? {
                    accountHolderName: bankDetails.accountHolderName,
                    accountNumber: bankDetails.accountNumber,
                    bankName: bankDetails.bankName,
                    ifscCode: bankDetails.ifscCode,
                    branchName: bankDetails.branchName,
                    accountType: bankDetails.accountType
                } : undefined,
                aadharCardImage,
                passportPhoto,
                offerLetter
            });

            const savedDocument = await newDocument.save();

            res.status(201).json({
                success: true,
                message: 'User verification document created successfully',
                data: savedDocument
            });
        } catch (error) {
            next(error);
        }
    },
    updateByUserId: async (req, res, next) => {
        try {
            const { userId } = req.params;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const {
                name,
                department,
                position,
                jobType,
                beforeBlissSalary,
                blissSalary,
                joiningDate,
                currentAddress,
                permanentAddress,
                experience,
                bankDetails,
                aadharCardImage,
                passportPhoto,
                offerLetter
            } = req.body;

            const updateFields = {};

            if (typeof name === 'string') updateFields.name = name;
            if (typeof department === 'string') updateFields.department = department;
            if (typeof position === 'string') updateFields.position = position;
            if (typeof jobType === 'string') updateFields.jobType = jobType;

            if (beforeBlissSalary !== undefined) {
                const num = Number(beforeBlissSalary);
                if (!Number.isNaN(num)) updateFields.beforeBlissSalary = num;
            }
            if (blissSalary !== undefined) {
                const num = Number(blissSalary);
                if (!Number.isNaN(num)) {
                    updateFields.blissSalary = num;
                    updateFields.pfFund = Math.round(num * 0.10);
                }
            }
            if (joiningDate !== undefined) {
                const d = new Date(joiningDate);
                if (!isNaN(d.getTime())) updateFields.joiningDate = d;
            }

            if (typeof currentAddress === 'string') updateFields.currentAddress = currentAddress;
            if (typeof permanentAddress === 'string') updateFields.permanentAddress = permanentAddress;
            if (typeof experience === 'string') updateFields.experience = experience;

            if (bankDetails && typeof bankDetails === 'object') {
                updateFields.bankDetails = {};
                if (typeof bankDetails.accountHolderName === 'string') updateFields.bankDetails.accountHolderName = bankDetails.accountHolderName;
                if (typeof bankDetails.accountNumber === 'string') updateFields.bankDetails.accountNumber = bankDetails.accountNumber;
                if (typeof bankDetails.bankName === 'string') updateFields.bankDetails.bankName = bankDetails.bankName;
                if (typeof bankDetails.ifscCode === 'string') updateFields.bankDetails.ifscCode = bankDetails.ifscCode;
                if (typeof bankDetails.branchName === 'string') updateFields.bankDetails.branchName = bankDetails.branchName;
                if (typeof bankDetails.accountType === 'string') updateFields.bankDetails.accountType = bankDetails.accountType;
            }

            if (typeof aadharCardImage === 'string') updateFields.aadharCardImage = aadharCardImage;
            if (typeof passportPhoto === 'string') updateFields.passportPhoto = passportPhoto;
            if (typeof offerLetter === 'string') updateFields.offerLetter = offerLetter;

            const updated = await UserVerificationDocumentsModel.findOneAndUpdate(
                { userId },
                { $set: updateFields },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Verification document not found for this user'
                });
            }

            res.status(200).json({
                success: true,
                message: 'User verification document updated successfully',
                data: updated
            });
        } catch (error) {
            next(error);
        }
    },

    // PATCH /api/userverificationdocuments/incrementSalary/:userId
    incrementSalary: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { incrementPercent, effectiveFrom, note } = req.body;

            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId is required' });
            }
            if (incrementPercent === undefined || incrementPercent <= 0) {
                return res.status(400).json({ success: false, message: 'Valid incrementPercent is required' });
            }

            const document = await UserVerificationDocumentsModel.findOne({ userId });
            if (!document) {
                return res.status(404).json({ success: false, message: 'User document not found' });
            }

            if (!document.blissSalary) {
                return res.status(400).json({ success: false, message: 'User has no base blissSalary set' });
            }

            const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            effectiveDate.setHours(0, 0, 0, 0);

            const isFutureIncrement = effectiveDate > today;
            const oldSalary = document.blissSalary;
            const incrementAmount = Math.round(oldSalary * (incrementPercent / 100));
            const newSalary = oldSalary + incrementAmount;
            const pfAmount = Math.round(newSalary * 0.10);

            const historyEntry = {
                incrementPercent,
                oldSalary,
                newSalary,
                incrementAmount,
                pfAmount,
                effectiveDate,
                note,
                status: isFutureIncrement ? 'pending_approval' : 'active'
            };

            let updateQuery;
            if (isFutureIncrement) {
                // Future increment - just add to history, don't update current salary
                updateQuery = {
                    $push: { salaryIncrementHistory: historyEntry }
                };
            } else {
                // Immediate increment - update salary and mark previous active increments as superseded
                updateQuery = {
                    $set: {
                        blissSalary: newSalary,
                        pfFund: pfAmount
                    },
                    $push: { salaryIncrementHistory: historyEntry }
                };

                // Mark previous active increments as superseded
                await UserVerificationDocumentsModel.updateOne(
                    { userId },
                    { $set: { 'salaryIncrementHistory.$[elem].status': 'superseded' } },
                    { arrayFilters: [{ 'elem.status': 'active' }] }
                );
            }

            const updated = await UserVerificationDocumentsModel.findOneAndUpdate(
                { userId },
                updateQuery,
                { new: true }
            );

            res.status(200).json({
                success: true,
                message: isFutureIncrement
                    ? 'Salary increment scheduled and pending approval'
                    : 'Salary incremented successfully',
                data: {
                    oldBlissSalary: oldSalary,
                    incrementPercent,
                    incrementAmount,
                    newBlissSalary: newSalary,
                    pfAmount,
                    effectiveDate,
                    status: historyEntry.status,
                    currentSalary: updated.blissSalary,
                    currentPF: updated.pfFund
                }
            });

        } catch (error) {
            next(error);
        }
    },

    // GET /api/userverificationdocuments/salaryDetails/:userId
    getSalaryDetails: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const document = await UserVerificationDocumentsModel.findOne({ userId });

            if (!document) {
                return res.status(404).json({ success: false, message: 'User document not found' });
            }

            // Separate pending, approved, and completed increments
            const pendingIncrements = (document.salaryIncrementHistory || [])
                .filter(inc => inc.status === 'pending_approval' || inc.status === 'approved')
                .sort((a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate));

            const completedIncrements = (document.salaryIncrementHistory || [])
                .filter(inc => inc.status === 'active' || inc.status === 'superseded' || inc.status === 'rejected')
                .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));

            res.status(200).json({
                success: true,
                data: {
                    currentSalary: {
                        beforeBlissSalary: document.beforeBlissSalary,
                        blissSalary: document.blissSalary,
                        pfFund: document.pfFund
                    },
                    pendingIncrements: pendingIncrements.map(inc => ({
                        incrementPercent: inc.incrementPercent,
                        newSalary: inc.newSalary,
                        newPF: inc.pfAmount,
                        effectiveDate: inc.effectiveDate,
                        note: inc.note,
                        status: inc.status
                    })),
                    history: completedIncrements
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userverificationdocuments/applyPendingIncrements
    applyPendingIncrements: async (req, res, next) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Find all documents with approved increments that should be activated
            const documents = await UserVerificationDocumentsModel.find({
                'salaryIncrementHistory.status': 'approved',
                'salaryIncrementHistory.effectiveDate': { $lte: today }
            });

            let updatedCount = 0;

            for (const doc of documents) {
                const pendingToApply = doc.salaryIncrementHistory
                    .filter(inc => inc.status === 'approved' && new Date(inc.effectiveDate) <= today)
                    .sort((a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate));

                if (pendingToApply.length > 0) {
                    // Apply the most recent pending increment
                    const latestIncrement = pendingToApply[pendingToApply.length - 1];

                    // Mark all previous active increments as superseded
                    await UserVerificationDocumentsModel.updateOne(
                        { _id: doc._id },
                        { $set: { 'salaryIncrementHistory.$[elem].status': 'superseded' } },
                        { arrayFilters: [{ 'elem.status': 'active' }] }
                    );

                    // Update the salary and mark this increment as active
                    await UserVerificationDocumentsModel.updateOne(
                        { _id: doc._id, 'salaryIncrementHistory._id': latestIncrement._id },
                        {
                            $set: {
                                blissSalary: latestIncrement.newSalary,
                                pfFund: latestIncrement.pfAmount,
                                'salaryIncrementHistory.$.status': 'active'
                            }
                        }
                    );

                    updatedCount++;
                }
            }

            res.status(200).json({
                success: true,
                message: `Applied pending increments for ${updatedCount} user(s)`,
                updatedCount
            });
        } catch (error) {
            next(error);
        }
    },

    // PATCH /api/userverificationdocuments/approveIncrement/:userId/:incrementId
    approveIncrement: async (req, res, next) => {
        try {
            const { userId, incrementId } = req.params;
            const { status } = req.body; // 'approved' or 'rejected'

            if (!status || !['approved', 'rejected'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid status. Use "approved" or "rejected".' });
            }

            const document = await UserVerificationDocumentsModel.findOne({ userId });
            if (!document) {
                return res.status(404).json({ success: false, message: 'User document not found' });
            }

            const incrementIndex = document.salaryIncrementHistory.findIndex(inc => inc._id.toString() === incrementId);
            if (incrementIndex === -1) {
                return res.status(404).json({ success: false, message: 'Increment not found' });
            }

            const increment = document.salaryIncrementHistory[incrementIndex];

            // Only allow approval if it's currently pending
            if (increment.status !== 'pending_approval') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot approve/reject increment with status "${increment.status}"`
                });
            }

            // Update status
            const updated = await UserVerificationDocumentsModel.findOneAndUpdate(
                { userId, 'salaryIncrementHistory._id': incrementId },
                {
                    $set: { 'salaryIncrementHistory.$.status': status }
                },
                { new: true }
            );

            res.status(200).json({
                success: true,
                message: `Increment ${status} successfully`,
                data: updated.salaryIncrementHistory.find(inc => inc._id.toString() === incrementId)
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = userVerificationDocumentsController;
