const RealEstateProjectModel = require('./RealEstateProjectSchema/RealEstateProjectSchema');
const RealEstateProjectTypeModel = require('./RealEstateProjectSchema/RealEstateProjectTypeSchema');

// Normalize array fields (support both array and JSON string from form data)
const parseArrayField = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return value ? [value] : [];
        }
    }
    return [];
};

const DEFAULT_PROJECT_TYPES = ['Plotted Development', 'Villa', 'Apartment'];

async function ensureProjectTypesSeeded() {
    // seed once per process; safe to call multiple times
    if (ensureProjectTypesSeeded._done) return;
    ensureProjectTypesSeeded._done = true;
    try {
        await Promise.all(
            DEFAULT_PROJECT_TYPES.map((name) =>
                RealEstateProjectTypeModel.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true })
            )
        );
    } catch (e) {
        // don't block main flows if types collection is unavailable
        console.warn('ProjectType seed warning:', e.message);
    }
}

async function upsertProjectType(name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return;
    await ensureProjectTypesSeeded();
    await RealEstateProjectTypeModel.updateOne(
        { name: trimmed },
        { $setOnInsert: { name: trimmed } },
        { upsert: true }
    );
}

const realEstateProjectController = {
    // POST /api/realEstate/project/create
    createProject: async (req, res, next) => {
        try {
            const {
                projectName,
                projectLocation,
                projectPrice,
                projectType,
                projectSize,
                possessionDate,
                projectImages,
                floorPlanImages,
                projectSlideHeroImages,
                groupSize,
                projectDescriptionAndDetails,
                tag,
                latitude,
                longitude,
                amenities
            } = req.body;

            // Validate required fields
            if (!projectName || !projectLocation || !projectPrice || !groupSize || !projectDescriptionAndDetails || !tag) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            // Auto-add new project type to category list (if provided)
            try {
                await upsertProjectType(projectType);
            } catch (e) {
                console.warn('ProjectType upsert warning:', e.message);
            }

            const newProject = new RealEstateProjectModel({
                projectName,
                projectLocation,
                projectPrice,
                projectType: projectType ? String(projectType).trim() : undefined,
                projectSize: projectSize || undefined,
                possessionDate: possessionDate ? String(possessionDate).trim() : undefined,
                projectImages: parseArrayField(projectImages),
                floorPlanImages: parseArrayField(floorPlanImages),
                projectSlideHeroImages: parseArrayField(projectSlideHeroImages),
                groupSize,
                projectDescriptionAndDetails,
                tag,
                latitude,
                longitude,
                amenities
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

    // POST /api/realEstate/projectType/create - Add a new project type/category
    createProjectType: async (req, res, next) => {
        try {
            const { name } = req.body || {};
            const trimmed = typeof name === 'string' ? name.trim() : '';
            if (!trimmed) {
                return res.status(400).json({ success: false, message: 'name is required' });
            }

            await ensureProjectTypesSeeded();
            await RealEstateProjectTypeModel.updateOne(
                { name: trimmed },
                { $setOnInsert: { name: trimmed } },
                { upsert: true }
            );

            const all = await RealEstateProjectTypeModel.find().sort({ name: 1 }).select('-__v');
            res.status(201).json({ success: true, message: 'Project type saved', data: all });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/realEstate/projectType/getAll - Get all project types/categories
    getAllProjectTypes: async (req, res, next) => {
        try {
            await ensureProjectTypesSeeded();
            const all = await RealEstateProjectTypeModel.find().sort({ name: 1 }).select('-__v');
            res.status(200).json({ success: true, count: all.length, data: all });
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
            const updates = { ...req.body };

            // Normalize array fields so they save correctly (array or JSON string from form)
            if (updates.projectImages !== undefined) updates.projectImages = parseArrayField(updates.projectImages);
            if (updates.floorPlanImages !== undefined) updates.floorPlanImages = parseArrayField(updates.floorPlanImages);
            if (updates.projectSlideHeroImages !== undefined) updates.projectSlideHeroImages = parseArrayField(updates.projectSlideHeroImages);

            if (updates.projectType !== undefined) {
                updates.projectType = updates.projectType ? String(updates.projectType).trim() : undefined;
                try {
                    await upsertProjectType(updates.projectType);
                } catch (e) {
                    console.warn('ProjectType upsert warning:', e.message);
                }
            }

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
    },

    // GET /api/realEstate/amenities/getAll
    getAllAmenities: async (req, res, next) => {
        try {
            const amenities = await RealEstateProjectModel.aggregate([
                { $unwind: "$amenities" },
                {
                    $group: {
                        _id: "$amenities.name",
                        name: { $first: "$amenities.name" },
                        icon: { $first: "$amenities.icon" }
                    }
                },
                { $project: { _id: 0, name: 1, icon: 1 } },
                { $sort: { name: 1 } }
            ]);

            res.status(200).json({
                success: true,
                message: 'Amenities fetched successfully',
                data: amenities
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = realEstateProjectController;
