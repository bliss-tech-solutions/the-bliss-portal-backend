const TeamManagementModel = require('./TeamManagementSchema/TeamManagementSchema');
const UserDetailsModel = require('../UserDetails/UserDetailsSchema/UserDetailsSchema');

const teamManagementController = {
    // GET /api/teammanagement/getAllTeams - Get all teams
    getAllTeams: async (req, res, next) => {
        try {
            const teams = await TeamManagementModel.find().sort({ createdAt: -1 });
            
            res.status(200).json({
                success: true,
                message: 'Teams retrieved successfully',
                data: teams,
                count: teams.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/teammanagement/getTeamById/:teamId - Get team by ID
    getTeamById: async (req, res, next) => {
        try {
            const { teamId } = req.params;
            
            const team = await TeamManagementModel.findById(teamId);
            
            if (!team) {
                return res.status(404).json({
                    success: false,
                    message: 'Team not found'
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Team retrieved successfully',
                data: team
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/teammanagement/getTeamsByUserId/:userId - Get teams where user is a member
    getTeamsByUserId: async (req, res, next) => {
        try {
            const { userId } = req.params;
            
            const teams = await TeamManagementModel.find({
                'members.userId': userId
            }).sort({ createdAt: -1 });
            
            res.status(200).json({
                success: true,
                message: 'Teams retrieved successfully',
                data: teams,
                count: teams.length
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/teammanagement/createTeam - Create new team
    createTeam: async (req, res, next) => {
        try {
            const {
                teamName,
                members, // Array of { userId, name, role }
                teamLeader // userId of team leader
            } = req.body;

            // Validate required fields
            if (!teamName || !members || !Array.isArray(members) || members.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: teamName and members array are required'
                });
            }

            if (!teamLeader) {
                return res.status(400).json({
                    success: false,
                    message: 'teamLeader is required'
                });
            }

            // Check for duplicate team name
            const existingTeam = await TeamManagementModel.findOne({
                teamName: { $regex: new RegExp(`^${teamName}$`, 'i') }
            });

            if (existingTeam) {
                return res.status(400).json({
                    success: false,
                    message: 'Team name already exists. Please use a different name.',
                    data: {
                        existingTeamId: existingTeam._id,
                        existingTeamName: existingTeam.teamName
                    }
                });
            }

            // Validate and normalize members array
            const normalizedMembers = [];
            const userIds = new Set(); // Track unique userIds

            for (const member of members) {
                if (!member.userId || !member.name) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each member must have userId and name'
                    });
                }

                // Check for duplicate userIds in the same team
                if (userIds.has(member.userId)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate user found: ${member.name} (${member.userId})`
                    });
                }
                userIds.add(member.userId);

                // Validate role
                const role = member.role === 'teamLeader' ? 'teamLeader' : 'member';
                
                normalizedMembers.push({
                    userId: member.userId,
                    name: member.name.trim(),
                    role: role
                });
            }

            // Validate that teamLeader is in members array
            const leaderInMembers = normalizedMembers.find(m => m.userId === teamLeader);
            if (!leaderInMembers) {
                return res.status(400).json({
                    success: false,
                    message: 'Team leader must be one of the selected team members'
                });
            }

            // Set team leader role in members array
            normalizedMembers.forEach(member => {
                if (member.userId === teamLeader) {
                    member.role = 'teamLeader';
                } else {
                    member.role = 'member';
                }
            });

            // Verify users exist in UserDetails (optional validation)
            const memberUserIds = normalizedMembers.map(m => m.userId);
            const existingUsers = await UserDetailsModel.find({ userId: { $in: memberUserIds } });
            
            if (existingUsers.length !== memberUserIds.length) {
                const foundUserIds = existingUsers.map(u => u.userId);
                const missingUserIds = memberUserIds.filter(id => !foundUserIds.includes(id));
                return res.status(400).json({
                    success: false,
                    message: 'Some users not found in system',
                    data: { missingUserIds }
                });
            }

            const newTeam = new TeamManagementModel({
                teamName: teamName.trim(),
                members: normalizedMembers,
                teamLeader: teamLeader
            });

            const savedTeam = await newTeam.save();

            res.status(201).json({
                success: true,
                message: 'Team created successfully',
                data: savedTeam
            });
        } catch (error) {
            // Handle duplicate key error (unique teamName)
            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'Team name already exists. Please use a different name.'
                });
            }
            next(error);
        }
    },

    // PUT /api/teammanagement/updateTeam/:teamId - Update team
    updateTeam: async (req, res, next) => {
        try {
            const { teamId } = req.params;
            const {
                teamName,
                members,
                teamLeader
            } = req.body;

            // Check if team exists
            const team = await TeamManagementModel.findById(teamId);
            if (!team) {
                return res.status(404).json({
                    success: false,
                    message: 'Team not found'
                });
            }

            // Build update object
            const updateData = {};

            // Update team name if provided
            if (teamName !== undefined && teamName !== team.teamName) {
                // Check for duplicate team name
                const existingTeam = await TeamManagementModel.findOne({
                    teamName: { $regex: new RegExp(`^${teamName}$`, 'i') },
                    _id: { $ne: teamId }
                });

                if (existingTeam) {
                    return res.status(400).json({
                        success: false,
                        message: 'Team name already exists. Please use a different name.'
                    });
                }
                updateData.teamName = teamName.trim();
            }

            // Update members if provided
            if (members !== undefined && Array.isArray(members)) {
                if (members.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Team must have at least one member'
                    });
                }

                const normalizedMembers = [];
                const userIds = new Set();

                for (const member of members) {
                    if (!member.userId || !member.name) {
                        return res.status(400).json({
                            success: false,
                            message: 'Each member must have userId and name'
                        });
                    }

                    if (userIds.has(member.userId)) {
                        return res.status(400).json({
                            success: false,
                            message: `Duplicate user found: ${member.name}`
                        });
                    }
                    userIds.add(member.userId);

                    const role = member.role === 'teamLeader' ? 'teamLeader' : 'member';
                    normalizedMembers.push({
                        userId: member.userId,
                        name: member.name.trim(),
                        role: role
                    });
                }

                updateData.members = normalizedMembers;
            }

            // Update team leader if provided
            if (teamLeader !== undefined) {
                // Get current members (use updated members if provided, otherwise existing)
                const currentMembers = updateData.members || team.members;
                const leaderInMembers = currentMembers.find(m => m.userId === teamLeader);
                
                if (!leaderInMembers) {
                    return res.status(400).json({
                        success: false,
                        message: 'Team leader must be one of the team members'
                    });
                }

                updateData.teamLeader = teamLeader;

                // Update role in members array
                if (updateData.members) {
                    updateData.members.forEach(member => {
                        if (member.userId === teamLeader) {
                            member.role = 'teamLeader';
                        } else {
                            member.role = 'member';
                        }
                    });
                } else {
                    // Update existing members array
                    const updatedMembers = team.members.map(member => ({
                        ...member.toObject(),
                        role: member.userId === teamLeader ? 'teamLeader' : 'member'
                    }));
                    updateData.members = updatedMembers;
                }
            }

            const updatedTeam = await TeamManagementModel.findByIdAndUpdate(
                teamId,
                updateData,
                { new: true, runValidators: true }
            );

            res.status(200).json({
                success: true,
                message: 'Team updated successfully',
                data: updatedTeam
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'Team name already exists. Please use a different name.'
                });
            }
            next(error);
        }
    },

    // DELETE /api/teammanagement/deleteTeam/:teamId - Delete team
    deleteTeam: async (req, res, next) => {
        try {
            const { teamId } = req.params;

            const team = await TeamManagementModel.findById(teamId);
            if (!team) {
                return res.status(404).json({
                    success: false,
                    message: 'Team not found'
                });
            }

            await TeamManagementModel.findByIdAndDelete(teamId);

            res.status(200).json({
                success: true,
                message: 'Team deleted successfully',
                data: {
                    deletedTeamId: teamId,
                    teamName: team.teamName
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = teamManagementController;

