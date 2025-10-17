const sendResponse = (res, statusCode, success, message, data = null, errors = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

const sendSuccess = (res, message, data = null, statusCode = 200) => {
  return sendResponse(res, statusCode, true, message, data);
};

const sendError = (res, message, errors = null, statusCode = 400) => {
  return sendResponse(res, statusCode, false, message, null, errors);
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendError
};
