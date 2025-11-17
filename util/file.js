const fs = require('fs');

const deleteFile = (filePath) => {
  fs.access(filePath, fs.constants.F_OK, (err) => {                       // First check if the file exists 
    if (err) {
      console.warn("File not found, skipping delete:", filePath);        // File does NOT exist → prevent crash
      return;
    }
    fs.unlink(filePath, (err) => {                                       // File exists → delete it
      if (err) {
        console.error("Error deleting file:", err);
      } else {
        console.log("File deleted:", filePath);
      }
    });
  });
};
exports.deleteFile = deleteFile;
