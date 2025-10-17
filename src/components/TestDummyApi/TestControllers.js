const TestDummyDataModel = require('./TestDummyDataSchema/TestDummyDataSchema');

const testDummyController = {
  // GET /api/testdummyapi - Get all data
  getAll: async (req, res, next) => {
    try {
      const data = await TestDummyDataModel.find();
      
      res.status(200).json({
        success: true,
        message: 'Data retrieved successfully',
        data: data,
        count: data.length
      });
    } catch (error) {
      next(error);
    }
  },

  // POST /api/testdummyapi - Create new data
  create: async (req, res, next) => {
    try {
      const { name, email, number, password } = req.body;
      
      console.log('📝 Creating new data:', { name, email, number, password });
      
      const newData = new TestDummyDataModel({
        name,
        email,
        number,
        password
      });
      
      const savedData = await newData.save();
      
      res.status(201).json({
        success: true,
        message: 'Data created successfully',
        data: savedData
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = testDummyController;