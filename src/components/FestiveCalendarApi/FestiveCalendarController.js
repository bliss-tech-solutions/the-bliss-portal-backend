const FestiveCalendarModel = require('./FestiveCalendarSchema/FestiveCalendarSchema');
const { getIO } = require('../../utils/socket');

const festiveCalendarController = {
    // POST /api/festive/note - add a note to a date
    addNote: async (req, res, next) => {
        try {
            const { date, note, userId, color, description, eventType } = req.body;
            if (!date || !note) {
                return res.status(400).json({ success: false, message: 'date and note are required' });
            }

            const update = { $push: { notes: { note, userId, color, description, eventType, createdAt: new Date() } } };
            const doc = await FestiveCalendarModel.findOneAndUpdate(
                { date },
                update,
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );

            // Emit real-time event via Socket.IO
            try {
                const io = getIO && getIO();
                if (io) {
                    const payload = { date, note, userId, color, description, eventType, docId: doc._id };
                    io.emit('festive:noteAdded', payload);
                    io.to(`festive:${date}`).emit('festive:noteAdded', payload);
                }
            } catch (_) { /* ignore socket errors */ }

            res.status(201).json({ success: true, message: 'Note added', data: doc });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/festive/notes?date=YYYY-MM-DD - get notes for a date
    getNotesByDate: async (req, res, next) => {
        try {
            const { date } = req.query;
            if (!date) {
                return res.status(400).json({ success: false, message: 'date is required' });
            }
            const doc = await FestiveCalendarModel.findOne({ date });
            res.status(200).json({ success: true, message: 'Notes retrieved', data: doc ? doc.notes : [] });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/festive/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    getNotesInRange: async (req, res, next) => {
        try {
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
            }

            const docs = await FestiveCalendarModel.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 });
            res.status(200).json({ success: true, message: 'Notes retrieved', data: docs });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/festive/user/:userId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    getNotesByUser: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { startDate, endDate } = req.query;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId is required' });
            }

            const dateFilter = startDate && endDate ? { date: { $gte: startDate, $lte: endDate } } : {};
            const docs = await FestiveCalendarModel.find(dateFilter).sort({ date: 1 });

            const results = [];
            for (const d of docs) {
                const userNotes = (d.notes || []).filter(n => n.userId === userId);
                if (userNotes.length > 0) {
                    results.push({ date: d.date, notes: userNotes });
                }
            }

            res.status(200).json({ success: true, message: 'User notes retrieved', data: results });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/festive/update - update specific note (by noteId) or other fields on date doc (no top-level archive)
    updatedFestiveTask: async (req, res, next) => {
        try {
            const { date, noteId, note, color, archive, description } = req.body;
            if (!date) {
                return res.status(400).json({ success: false, message: 'date is required' });
            }

            const doc = await FestiveCalendarModel.findOne({ date });
            if (!doc) {
                return res.status(404).json({ success: false, message: 'Date not found' });
            }

            // If noteId provided, allow note-level description update below

            // Optionally update a specific note by _id
            if (noteId) {
                const n = (doc.notes || []).find((x) => String(x._id) === String(noteId));
                if (!n) {
                    return res.status(404).json({ success: false, message: 'Note not found' });
                }
                if (typeof note === 'string') n.note = note;
                if (typeof color === 'string') n.color = color;
                if (typeof description === 'string') n.description = description;
                if (typeof eventType === 'string') n.eventType = eventType;
                if (typeof archive === 'boolean') n.archive = archive;
            }

            await doc.save();

            // Emit real-time event for updates
            try {
                const io = getIO && getIO();
                if (io) {
                    io.emit('festive:updated', { date, noteId, note, color, description, archive, eventType, docId: doc._id });
                    io.to(`festive:${date}`).emit('festive:updated', { date, noteId, note, color, description, archive, eventType, docId: doc._id });
                }
            } catch (_) { /* ignore socket errors */ }

            return res.status(200).json({ success: true, message: 'Festive task updated', data: doc });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/festive/note/:date/:noteId - delete a specific note
    deleteNote: async (req, res, next) => {
        try {
            const { date, noteId } = req.params;
            if (!date || !noteId) {
                return res.status(400).json({ success: false, message: 'date and noteId are required' });
            }

            const doc = await FestiveCalendarModel.findOne({ date });
            if (!doc) {
                return res.status(404).json({ success: false, message: 'Date not found' });
            }

            const initialLength = doc.notes.length;
            doc.notes = doc.notes.filter(n => String(n._id) !== String(noteId));

            if (doc.notes.length === initialLength) {
                return res.status(404).json({ success: false, message: 'Note not found' });
            }

            await doc.save();

            // Emit real-time event for deletion
            try {
                const io = getIO && getIO();
                if (io) {
                    io.emit('festive:noteDeleted', { date, noteId });
                    io.to(`festive:${date}`).emit('festive:noteDeleted', { date, noteId });
                }
            } catch (_) { /* ignore socket errors */ }

            return res.status(200).json({ success: true, message: 'Note deleted', data: doc });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = festiveCalendarController;


