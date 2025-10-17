const UserDetailsModel = require('./UserDetailsSchema/UserDetailsSchema');

const userDetailsController = {
    // GET /api/userdetails/getUserDetails - Get all user details
    getUserDetails: async (req, res, next) => {
        try {
            const data = await UserDetailsModel.find();

            res.status(200).json({
                success: true,
                message: 'User details retrieved successfully',
                data: data,
                count: data.length
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userdetails/addUserDetails - Create new user details
    addUserDetails: async (req, res, next) => {
        try {
            const {
                firstName,
                lastName,
                email,
                number,
                role,
                position,
                details,
                maritalStatus,
                birthDate,
                address,
                pincode,
                languages,
                skills
            } = req.body;

            console.log('📝 Creating new user details:', {
                firstName,
                lastName,
                email,
                number,
                role,
                position,
                details,
                maritalStatus,
                birthDate,
                address,
                pincode,
                languages,
                skills
            });

            // Check for duplicate email
            const existingEmail = await UserDetailsModel.findOne({ email: email });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists. Please use a different email address.'
                });
            }

            // Check for duplicate mobile number
            const existingNumber = await UserDetailsModel.findOne({ number: number });
            if (existingNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Mobile number already exists. Please use a different mobile number.'
                });
            }

            // Generate userId: <firstname>-bliss-<last4digitsOfMobile>
            const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const last4 = String(number).slice(-4);
            const generatedUserId = `${cleanFirst}-bliss-${last4}`;

            const newUserDetails = new UserDetailsModel({
                userId: generatedUserId,
                firstName,
                lastName,
                email,
                number,
                role,
                position,
                details,
                maritalStatus,
                birthDate,
                address,
                pincode,
                languages,
                skills
            });

            const savedData = await newUserDetails.save();

            res.status(201).json({
                success: true,
                message: 'User details created successfully',
                data: savedData
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/generateUserCredential - Generate user credentials
    generateUserCredential: async (req, res, next) => {
        try {
            const { userId } = req.body;

            console.log('🔐 Generating user credentials for userId:', userId);

            // Find the user by userId
            const user = await UserDetailsModel.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check if credentials already exist for this user
            if (user.userEmail && user.Password) {
                return res.status(400).json({
                    success: false,
                    message: 'Credentials already generated for this user'
                });
            }

            // Generate email: firstName + last 4 digits of mobile number + @blissSolution.com
            const cleanFirstName = user.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const lastFourDigits = user.number.slice(-4); // Get last 4 digits of mobile number
            const userEmail = `${cleanFirstName}${lastFourDigits}@blissSolution.com`;

            // Generate password (same for all users for now)
            const Password = '123456';

            // Update the user record with generated credentials
            const updatedUser = await UserDetailsModel.findByIdAndUpdate(
                userId,
                {
                    userEmail: userEmail,
                    Password: Password
                },
                { new: true }
            );

            console.log('✅ User credentials generated successfully:', {
                email: userEmail,
                password: Password
            });

            res.status(200).json({
                success: true,
                message: 'User credentials generated successfully',
                data: {
                    userEmail: userEmail,
                    Password: Password,
                    userId: userId,
                    user: updatedUser
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/signIn - User sign in
    signIn: async (req, res, next) => {
        try {
            const { userEmail, Password } = req.body;

            console.log('🔐 User attempting to sign in:', { userEmail });

            // Validate required fields
            if (!userEmail || !Password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            // Find user by userEmail and Password
            const user = await UserDetailsModel.findOne({
                userEmail: userEmail,
                Password: Password
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // Check if user has generated credentials
            if (!user.userEmail || !user.Password) {
                return res.status(401).json({
                    success: false,
                    message: 'User credentials not found. Please contact administrator.'
                });
            }

            console.log('✅ User signed in successfully:', {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                userEmail: user.userEmail
            });

            // Return user data (excluding sensitive information)
            const userData = {
                userId: user.userId,
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                number: user.number,
                role: user.role,
                position: user.position,
                details: user.details,
                maritalStatus: user.maritalStatus,
                birthDate: user.birthDate,
                address: user.address,
                pincode: user.pincode,
                languages: user.languages,
                skills: user.skills,
                userEmail: user.userEmail,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };

            res.status(200).json({
                success: true,
                message: 'Sign in successful',
                data: userData
            });

        } catch (error) {
            next(error);
        }
    },

    // POST /api/updatePassword - Update user's password
    updatePassword: async (req, res, next) => {
        try {
            const { userId, newPassword } = req.body;

            if (!userId || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'userId and newPassword are required'
                });
            }

            const user = await UserDetailsModel.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const updatedUser = await UserDetailsModel.findByIdAndUpdate(
                userId,
                { Password: newPassword },
                { new: true }
            );

            return res.status(200).json({
                success: true,
                message: 'Password updated successfully',
                data: {
                    userId: updatedUser._id,
                    userEmail: updatedUser.userEmail
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = userDetailsController;
