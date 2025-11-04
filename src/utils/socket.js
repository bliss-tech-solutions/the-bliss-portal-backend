let ioInstance = null;

function setIO(io) {
    ioInstance = io;
}9

function getIO() {
    return ioInstance;
}

module.exports = { setIO, getIO };




