const mongoose = require('mongoose');
require('dotenv').config();
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster1.qgutmsa.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?appName=Cluster1`;

console.log('Testing connection to:', MONGODB_URI.replace(process.env.MONGO_PASSWORD, '****'));

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected successfully!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection failed:', err.message);
        process.exit(1);
    });
