const RealEstateProjectModel = require('./RealEstateProjectSchema/RealEstateProjectSchema');
const RealEstateProjectTypeModel = require('./RealEstateProjectSchema/RealEstateProjectTypeSchema');
const RealEstateBhkOptionModel = require('./RealEstateProjectSchema/RealEstateBhkOptionSchema');

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

// Array of { title, value, icon } — supports JSON string from form; accepts Title/Value/Icon keys
const parseProjectCardsField = (value) => {
    const raw = parseArrayField(value);
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const title =
                item.title ?? item.Title ?? item.TITLE ?? '';
            const val =
                item.value ?? item.Value ?? item.VALUE ?? '';
            const icon =
                item.icon ?? item.Icon ?? item.ICON ?? '';
            return {
                title: String(title).trim(),
                value: String(val).trim(),
                icon: String(icon).trim()
            };
        })
        .filter((c) => c && c.title && c.value && c.icon);
};

const DEFAULT_PROJECT_TYPES = ['Plotted Development', 'Villa', 'Apartment'];
const DEFAULT_BHK_OPTIONS = ['Studio', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK'];

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

async function ensureBhkOptionsSeeded() {
    if (ensureBhkOptionsSeeded._done) return;
    ensureBhkOptionsSeeded._done = true;
    try {
        await Promise.all(
            DEFAULT_BHK_OPTIONS.map((name) =>
                RealEstateBhkOptionModel.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true })
            )
        );
    } catch (e) {
        console.warn('BHK seed warning:', e.message);
    }
}

async function upsertBhkOption(name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return;
    await ensureBhkOptionsSeeded();
    await RealEstateBhkOptionModel.updateOne(
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
                projectType,
                bhk,
                projectImages,
                floorPlanImages,
                projectSlideHeroImages,
                groupSize,
                latitude,
                longitude,
                amenities,
                projectCards
            } = req.body;

            // Validate required fields
            if (!projectName || !projectLocation || !groupSize) {
                return res.status(400).json({
                    success: false,
                    message: 'projectName, projectLocation, and groupSize are required'
                });
            }

            // Auto-add new project type to category list (if provided)
            try {
                await upsertProjectType(projectType);
            } catch (e) {
                console.warn('ProjectType upsert warning:', e.message);
            }

            // Auto-add new BHK option (if provided)
            try {
                await upsertBhkOption(bhk);
            } catch (e) {
                console.warn('BHK upsert warning:', e.message);
            }

            const newProject = new RealEstateProjectModel({
                projectName,
                projectLocation,
                projectType: projectType ? String(projectType).trim() : undefined,
                bhk: bhk ? String(bhk).trim() : undefined,
                projectImages: parseArrayField(projectImages),
                floorPlanImages: parseArrayField(floorPlanImages),
                projectSlideHeroImages: parseArrayField(projectSlideHeroImages),
                projectCards: parseProjectCardsField(projectCards),
                groupSize,
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

    // POST /api/realEstate/bhk/create - Add a new BHK option
    createBhkOption: async (req, res, next) => {
        try {
            const { name } = req.body || {};
            const trimmed = typeof name === 'string' ? name.trim() : '';
            if (!trimmed) {
                return res.status(400).json({ success: false, message: 'name is required' });
            }

            await ensureBhkOptionsSeeded();
            await RealEstateBhkOptionModel.updateOne(
                { name: trimmed },
                { $setOnInsert: { name: trimmed } },
                { upsert: true }
            );

            const all = await RealEstateBhkOptionModel.find().sort({ name: 1 }).select('-__v');
            res.status(201).json({ success: true, message: 'BHK option saved', data: all });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/realEstate/bhk/getAll - Get all BHK options
    getAllBhkOptions: async (req, res, next) => {
        try {
            await ensureBhkOptionsSeeded();
            const all = await RealEstateBhkOptionModel.find().sort({ name: 1 }).select('-__v');
            res.status(200).json({ success: true, count: all.length, data: all });
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

            const removedProjectFields = [
                'projectPrice',
                'projectSize',
                'possessionDate',
                'tag',
                'projectDescriptionAndDetails'
            ];
            removedProjectFields.forEach((k) => {
                delete updates[k];
            });

            // Normalize array fields so they save correctly (array or JSON string from form)
            if (updates.projectImages !== undefined) updates.projectImages = parseArrayField(updates.projectImages);
            if (updates.floorPlanImages !== undefined) updates.floorPlanImages = parseArrayField(updates.floorPlanImages);
            if (updates.projectSlideHeroImages !== undefined) updates.projectSlideHeroImages = parseArrayField(updates.projectSlideHeroImages);
            if (updates.projectCards !== undefined) updates.projectCards = parseProjectCardsField(updates.projectCards);

            if (updates.projectType !== undefined) {
                updates.projectType = updates.projectType ? String(updates.projectType).trim() : undefined;
                try {
                    await upsertProjectType(updates.projectType);
                } catch (e) {
                    console.warn('ProjectType upsert warning:', e.message);
                }
            }

            if (updates.bhk !== undefined) {
                updates.bhk = updates.bhk ? String(updates.bhk).trim() : undefined;
                try {
                    await upsertBhkOption(updates.bhk);
                } catch (e) {
                    console.warn('BHK upsert warning:', e.message);
                }
            }

            const mongoUpdate = {
                $unset: Object.fromEntries(removedProjectFields.map((k) => [k, '']))
            };
            if (Object.keys(updates).length > 0) {
                mongoUpdate.$set = updates;
            }

            const updatedProject = await RealEstateProjectModel.findByIdAndUpdate(id, mongoUpdate, { new: true });

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
