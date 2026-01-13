const RealEstateProjectModel = require('./RealEstateProjectSchema/RealEstateProjectSchema');

const realEstateProjectController = {
    // POST /api/realEstate/project/create
    createProject: async (req, res, next) => {
        try {
            const {
                projectName,
                projectLocation,
                projectPrice,
                projectImages,
                groupSize,
                lastDayToJoin,
                projectDescriptionAndDetails,
                tag
            } = req.body;

            // Validate required fields
            if (!projectName || !projectLocation || !projectPrice || !groupSize || !lastDayToJoin || !projectDescriptionAndDetails || !tag) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            const newProject = new RealEstateProjectModel({
                projectName,
                projectLocation,
                projectPrice,
                projectImages,
                groupSize,
                lastDayToJoin,
                projectDescriptionAndDetails,
                tag
            });

            const savedProject = await newProject.save();

            res.status(201).json({
                success: true,
                message: 'Project created successfully',
                data: savedProject
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/realEstate/project/getAll
    getAllProjects: async (req, res, next) => {
        try {
            const projects = await RealEstateProjectModel.find().sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                message: 'Projects fetched successfully',
                data: projects
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/realEstate/project/getById/:id
    getProjectById: async (req, res, next) => {
        try {
            const { id } = req.params;
            const project = await RealEstateProjectModel.findById(id);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Project fetched successfully',
                data: project
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/realEstate/project/update/:id
    updateProject: async (req, res, next) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            const updatedProject = await RealEstateProjectModel.findByIdAndUpdate(id, updates, { new: true });

            if (!updatedProject) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Project updated successfully',
                data: updatedProject
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/realEstate/project/delete/:id
    deleteProject: async (req, res, next) => {
        try {
            const { id } = req.params;
            const deletedProject = await RealEstateProjectModel.findByIdAndDelete(id);

            if (!deletedProject) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Project deleted successfully',
                data: deletedProject
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = realEstateProjectController;
