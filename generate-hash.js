const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const password = process.argv[2];

if (!password) {
    console.log('\nUsage: node generate-hash.js <your_password>\n');
    console.log('Example: node generate-hash.js mysecret123\n');
    process.exit(1);
}

const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);

console.log('\n==================================================');
console.log('Password Hash Generated Successfully!');
console.log('==================================================');
console.log(`Password: ${password}`);
console.log(`Bcrypt Hash: ${hash}`);
console.log('==================================================\n');

const envPath = path.join(__dirname, '.env');
const jwtSecret = require('crypto').randomBytes(32).toString('hex');

if (!fs.existsSync(envPath)) {
    const envContent = `PASSWORD_HASH=${hash}\nJWT_SECRET=${jwtSecret}\nPORT=3000\n`;
    fs.writeFileSync(envPath, envContent);
    console.log('Created .env file automatically with your password hash and a secure JWT secret.');
} else {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('PASSWORD_HASH=')) {
        envContent = envContent.replace(/PASSWORD_HASH=.*/, `PASSWORD_HASH=${hash}`);
    } else {
        envContent += `\nPASSWORD_HASH=${hash}`;
    }
    if (!envContent.includes('JWT_SECRET=')) {
        envContent += `\nJWT_SECRET=${jwtSecret}`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log('Updated .env file with your new password hash!');
}
console.log('Make sure .env is in your .gitignore file.\n');
