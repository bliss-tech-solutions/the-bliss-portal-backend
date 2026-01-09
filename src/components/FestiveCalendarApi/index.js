const express = require('express');
const router = express.Router();

const festiveCalendarController = require('./FestiveCalendarController');

// POST /api/festive/note - add note to a date
router.post('/festive/note', festiveCalendarController.addNote);

// GET /api/festive/notes?date=YYYY-MM-DD - get notes for a date
router.get('/festive/notes', festiveCalendarController.getNotesByDate);

// GET /api/festive/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - get notes in range
router.get('/festive/range', festiveCalendarController.getNotesInRange);

// GET /api/festive/user/:userId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - notes by user
router.get('/festive/user/:userId', festiveCalendarController.getNotesByUser);

// PUT /api/festive/note - update archive and/or a note
router.put('/festive/note', festiveCalendarController.updatedFestiveTask);

// DELETE /api/festive/note/:date/:noteId - delete a note
router.delete('/festive/note/:date/:noteId', festiveCalendarController.deleteNote);

module.exports = router;


