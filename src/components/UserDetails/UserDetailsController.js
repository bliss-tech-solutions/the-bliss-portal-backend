const UserDetailsModel = require('./UserDetailsSchema/UserDetailsSchema');
const { getIO } = require('../../utils/socket');

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

            // Emit real-time analytics update via Socket.IO
            try {
                const io = getIO && getIO();
                if (io) {
                    const totalEmployees = await UserDetailsModel.countDocuments();
                    // Emit to analytics room for real-time updates
                    io.to('analytics').emit('analytics:totalEmployees', {
                        totalEmployees,
                        timestamp: new Date().toISOString()
                    });
                    // Emit departments updated (new user added affects department counts)
                    io.to('analytics').emit('analytics:departmentsUpdated', {
                        timestamp: new Date().toISOString()
                    });
                    // Emit growth rate updated (new user added affects growth)
                    io.to('analytics').emit('analytics:growthRateUpdated', {
                        timestamp: new Date().toISOString()
                    });
                    // Emit overview updated (affects all analytics)
                    io.to('analytics').emit('analytics:overviewUpdated', {
                        timestamp: new Date().toISOString()
                    });
                    // Also emit user created event
                    io.emit('user:created', { userId: savedData.userId, _id: String(savedData._id), data: savedData });
                }
            } catch (socketError) {
                // Ignore socket errors, don't fail the API
                console.error('Socket.IO error in addUserDetails:', socketError.message);
            }

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
    ,

    // PUT /api/updateUserDetails/:userId - Update user's profile fields
    updateUserDetails: async (req, res, next) => {
        try {
            const paramUserId = req.params.userId; // custom userId (not _id)
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

            if (!paramUserId) {
                return res.status(400).json({ success: false, message: 'userId is required in the URL' });
            }

            const user = await UserDetailsModel.findOne({ userId: paramUserId });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // If email is changing, ensure uniqueness
            if (typeof email === 'string' && email !== user.email) {
                const existingEmail = await UserDetailsModel.findOne({ email });
                if (existingEmail) {
                    return res.status(400).json({ success: false, message: 'Email already exists' });
                }
            }

            // If number is changing, ensure uniqueness
            if (typeof number === 'string' && number !== user.number) {
                const existingNumber = await UserDetailsModel.findOne({ number });
                if (existingNumber) {
                    return res.status(400).json({ success: false, message: 'Mobile number already exists' });
                }
            }

            const updatePayload = {};
            if (typeof firstName === 'string') updatePayload.firstName = firstName;
            if (typeof lastName === 'string') updatePayload.lastName = lastName;
            if (typeof email === 'string') updatePayload.email = email;
            if (typeof number === 'string') updatePayload.number = number;
            if (typeof role === 'string') updatePayload.role = role;
            if (typeof position === 'string') updatePayload.position = position;
            if (typeof details === 'string') updatePayload.details = details;
            if (typeof maritalStatus === 'string') updatePayload.maritalStatus = maritalStatus;
            if (typeof birthDate === 'string') updatePayload.birthDate = birthDate;
            if (typeof address === 'string') updatePayload.address = address;
            if (typeof pincode === 'string') updatePayload.pincode = pincode;
            if (Array.isArray(languages)) updatePayload.languages = languages;
            if (Array.isArray(skills)) updatePayload.skills = skills;

            const updated = await UserDetailsModel.findByIdAndUpdate(
                user._id,
                updatePayload,
                { new: true }
            );

            // Emit real-time update via Socket.IO
            try {
                const io = getIO && getIO();
                if (io) {
                    const payload = { userId: updated.userId, _id: String(updated._id), data: updated };
                    io.emit('user:updated', payload);
                    io.to(`user:${updated.userId}`).emit('user:updated', payload);
                    // Emit analytics updates if role changed (affects departments)
                    if (updatePayload.role) {
                        const totalEmployees = await UserDetailsModel.countDocuments();
                        io.to('analytics').emit('analytics:totalEmployees', {
                            totalEmployees,
                            timestamp: new Date().toISOString()
                        });
                        io.to('analytics').emit('analytics:departmentsUpdated', {
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            } catch (socketError) {
                // Ignore socket errors, don't fail the API
                console.error('Socket.IO error in updateUserDetails:', socketError.message);
            }

            return res.status(200).json({ success: true, message: 'User details updated', data: updated });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = userDetailsController;
