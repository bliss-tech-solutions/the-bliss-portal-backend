const RealEstateUserModel = require('./realEstateUserSchema/realEstateUserSchema');

const realEstateUserController = {
    // POST /api/realEstate/create - Create New User
    createUser: async (req, res, next) => {
        try {
            const { fullName, mobileNumber, email, password } = req.body;

            // Validate required fields
            if (!fullName || !mobileNumber || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields (fullName, mobileNumber, email, password) are required'
                });
            }

            // Check for duplicate email
            const existingEmail = await RealEstateUserModel.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }

            // Check for duplicate mobile number
            const existingMobile = await RealEstateUserModel.findOne({ mobileNumber });
            if (existingMobile) {
                return res.status(400).json({
                    success: false,
                    message: 'Mobile number already exists'
                });
            }

            const newUser = new RealEstateUserModel({
                fullName,
                mobileNumber,
                email,
                password,
                isArchived: false
            });

            const savedUser = await newUser.save();

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: savedUser
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/realEstate/login - Login User
    // Note: Using POST for security to keep credentials out of URL logs
    loginUser: async (req, res, next) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const user = await RealEstateUserModel.findOne({ email, password, isArchived: false });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: user
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/realEstate/update/:id - Update User Details
    updateUser: async (req, res, next) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Prevent updating crucial fields to duplicates if passed
            if (updates.email) {
                const existingEmail = await RealEstateUserModel.findOne({ email: updates.email, _id: { $ne: id } });
                if (existingEmail) return res.status(400).json({ success: false, message: 'Email already in use' });
            }
            if (updates.mobileNumber) {
                const existingMobile = await RealEstateUserModel.findOne({ mobileNumber: updates.mobileNumber, _id: { $ne: id } });
                if (existingMobile) return res.status(400).json({ success: false, message: 'Mobile number already in use' });
            }

            const updatedUser = await RealEstateUserModel.findByIdAndUpdate(id, updates, { new: true });

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'User updated successfully',
                data: updatedUser
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/realEstate/delete/:id - Archive User
    deleteUser: async (req, res, next) => {
        try {
            const { id } = req.params;

            // Soft delete: set isArchived to true
            const archivedUser = await RealEstateUserModel.findByIdAndUpdate(
                id,
                { isArchived: true },
                { new: true }
            );

            if (!archivedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'User archived successfully',
                data: archivedUser
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = realEstateUserController;
