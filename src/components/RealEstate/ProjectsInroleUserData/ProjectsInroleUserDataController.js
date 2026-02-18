const ProjectsInroleUserDataModel = require('./ProjectsInroleUserDataSchema');
const RealEstateProjectModel = require('../RealEstateProject/RealEstateProjectSchema/RealEstateProjectSchema');
const RealEstateUserModel = require('../realEstateUserData/realEstateUserSchema/realEstateUserSchema');

/**
 * Enroll a user in a real estate project
 * @route POST /api/realEstate/project/enroll
 */
exports.enrollInProject = async (req, res) => {
    try {
        const { projectId, userId } = req.body;

        if (!projectId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'projectId and userId are required'
            });
        }

        // 1. Verify project exists
        const project = await RealEstateProjectModel.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        // 2. Verify user exists
        const user = await RealEstateUserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 3. Find or create the project enrollment document
        let enrollmentDoc = await ProjectsInroleUserDataModel.findOne({ projectId });

        if (!enrollmentDoc) {
            enrollmentDoc = new ProjectsInroleUserDataModel({
                projectId,
                groupSize: project.groupSize,
                remainingGroupSize: project.groupSize,
                users: []
            });
        }

        // 4. Check if user is already enrolled
        const alreadyEnrolled = enrollmentDoc.users.some(u => u.userId.toString() === userId.toString());
        if (alreadyEnrolled) {
            return res.status(400).json({
                success: false,
                message: 'User is already enrolled in this project'
            });
        }

        // 5. Check if group is full
        if (enrollmentDoc.users.length >= project.groupSize) {
            return res.status(400).json({
                success: false,
                message: 'Project group size is already full'
            });
        }

        // 6. Add user and update remaining size
        enrollmentDoc.users.push({ userId, enrolledAt: new Date() });
        enrollmentDoc.remainingGroupSize = project.groupSize - enrollmentDoc.users.length;

        await enrollmentDoc.save();

        res.status(201).json({
            success: true,
            message: 'User enrolled successfully',
            data: {
                projectId: enrollmentDoc.projectId,
                userId: userId, // Current user enrolled
                groupSize: enrollmentDoc.groupSize,
                remainingGroupSize: enrollmentDoc.remainingGroupSize,
                totalEnrolled: enrollmentDoc.users.length
            }
        });

    } catch (error) {
        console.error('Error in enrollInProject:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

/**
 * Unenroll a user from a real estate project
 * @route POST /api/realEstate/project/unenroll
 */
exports.unenrollFromProject = async (req, res) => {
    try {
        const { projectId, userId } = req.body;

        if (!projectId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'projectId and userId are required'
            });
        }

        // 1. Find the project enrollment document
        const enrollmentDoc = await ProjectsInroleUserDataModel.findOne({ projectId });

        if (!enrollmentDoc) {
            return res.status(404).json({
                success: false,
                message: 'Project enrollment not found'
            });
        }

        // 2. Check if user is enrolled
        const initialUserCount = enrollmentDoc.users.length;
        const userIndex = enrollmentDoc.users.findIndex(u => u.userId.toString() === userId.toString());

        if (userIndex === -1) {
            return res.status(400).json({
                success: false,
                message: 'User is not enrolled in this project'
            });
        }

        // 3. Remove User
        enrollmentDoc.users.splice(userIndex, 1);

        // 4. Update remaining group size
        // We get the project details to know the max group size (though we can assume existing logic maintained remaining properly)
        // Alternatively, since we just removed one, we can increment remainingGroupSize if we trust it, or recalculate.
        // Recalculating is safer if we know the total group size.
        // But the model has `remainingGroupSize` and `groupSize`.

        // Let's recalculate to be safe using the document's own groupSize field
        if (enrollmentDoc.groupSize) {
            enrollmentDoc.remainingGroupSize = enrollmentDoc.groupSize - enrollmentDoc.users.length;
        } else {
            // Fallback if groupSize missing (unlikely if created correctly), just increment
            enrollmentDoc.remainingGroupSize = (enrollmentDoc.remainingGroupSize || 0) + 1;
        }

        await enrollmentDoc.save();

        res.status(200).json({
            success: true,
            message: 'User unenrolled successfully',
            data: {
                projectId: enrollmentDoc.projectId,
                userId: userId,
                remainingGroupSize: enrollmentDoc.remainingGroupSize,
                totalEnrolled: enrollmentDoc.users.length
            }
        });

    } catch (error) {
        console.error('Error in unenrollFromProject:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

/**
 * Get all project enrollments (shows all projects with their status)
 * @route GET /api/realEstate/project/enroll/getAll
 */
exports.getAllEnrollments = async (req, res) => {
    try {
        const { userId } = req.query;
        const mongoose = require('mongoose');

        const pipeline = [
            {
                $lookup: {
                    from: 'ProjectsInroleUserData',
                    localField: '_id',
                    foreignField: 'projectId',
                    as: 'enrollmentInfo'
                }
            },
            {
                $unwind: {
                    path: '$enrollmentInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    projectName: 1,
                    projectLocation: 1,
                    projectPrice: 1,
                    projectImages: 1,
                    floorPlanImages: { $ifNull: ['$floorPlanImages', []] },
                    projectSlideHeroImages: { $ifNull: ['$projectSlideHeroImages', []] },
                    groupSize: 1,
                    lastDayToJoin: 1,
                    projectDescriptionAndDetails: 1,
                    tag: 1,
                    latitude: 1,
                    longitude: 1,
                    amenities: { $ifNull: ['$amenities', []] },
                    status: { $ifNull: ['$status', 'active'] },
                    createdAt: 1,
                    updatedAt: 1,
                    users: { $ifNull: ['$enrollmentInfo.users', []] },
                    remainingGroupSize: {
                        $ifNull: ['$enrollmentInfo.remainingGroupSize', '$groupSize']
                    },
                    totalEnrolled: {
                        $size: { $ifNull: ['$enrollmentInfo.users', []] }
                    },
                    isEnrolled: {
                        $cond: {
                            if: {
                                $and: [
                                    { $ne: [userId, undefined] },
                                    { $ne: [userId, ""] },
                                    { $in: [new mongoose.Types.ObjectId(userId), { $ifNull: ['$enrollmentInfo.users.userId', []] }] }
                                ]
                            },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ];

        // If userId is not provided, we should skip the ObjectId conversion to avoid errors
        if (!userId || userId === "") {
            pipeline[2].$project.isEnrolled = { $literal: false };
        }

        const enrollments = await RealEstateProjectModel.aggregate(pipeline);

        res.status(200).json({
            success: true,
            count: enrollments.length,
            data: enrollments
        });
    } catch (error) {
        console.error('Error in getAllEnrollments:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

/**
 * Get enrollments for a specific user
 * @route GET /api/realEstate/project/enroll/user/:userId
 */
exports.getEnrollmentsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required'
            });
        }

        const enrollments = await ProjectsInroleUserDataModel.find({
            'users.userId': userId
        })
            .populate('projectId')
            .populate('users.userId', 'fullName mobileNumber email');

        res.status(200).json({
            success: true,
            count: enrollments.length,
            data: enrollments
        });
    } catch (error) {
        console.error('Error in getEnrollmentsByUserId:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};
