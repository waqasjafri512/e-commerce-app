require('dotenv').config();
console.log('--- DB Config Debug ---');
console.log('MONGO_USER:', process.env.MONGO_USER);
console.log('MONGO_DEFAULT_DATABASE:', process.env.MONGO_DEFAULT_DATABASE);
console.log('STRIPE_KEY (exists):', !!process.env.STRIPE_KEY);
console.log('PORT:', process.env.PORT);
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster1.qgutmsa.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?appName=Cluster1`;
console.log('URI assembled (password masked):', MONGODB_URI.replace(process.env.MONGO_PASSWORD, '****'));
console.log('--- End Debug ---');
