const mongoose = require('mongoose');
const User = require('./models/user');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(() => {
        return User.findOne({ email: 'kashi54214@gmail.com' });
    })
    .then(user => {
        if (user) {
            console.log('User found:', user._id.toString());
        } else {
            console.log('User not found');
        }
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
