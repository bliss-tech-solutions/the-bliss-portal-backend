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
    }
};

module.exports = userVerificationDocumentsController;

