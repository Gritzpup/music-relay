#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('YouTube Cookie Setup Helper');
console.log('===========================\n');

console.log('To bypass YouTube bot detection, you need to provide cookies from your browser.');
console.log('This allows the bot to access YouTube as if it were your logged-in browser.\n');

console.log('Option 1: Export cookies from your browser');
console.log('-------------------------------------------');
console.log('1. Install a cookie export extension:');
console.log('   - Chrome/Edge: "Get cookies.txt" or "cookies.txt"');
console.log('   - Firefox: "cookies.txt"');
console.log('2. Go to youtube.com and make sure you\'re logged in');
console.log('3. Click the extension and export cookies for youtube.com');
console.log('4. Save the file as "cookies.txt" in the bot directory\n');

console.log('Option 2: Use browser cookies directly (requires Chrome/Firefox)');
console.log('-----------------------------------------------------------------');
console.log('The bot can read cookies directly from your browser profile.');
console.log('Add this to your .env file:');
console.log('COOKIES_FROM_BROWSER=chrome  # or firefox, edge, etc.\n');

console.log('Option 3: Manual cookie extraction');
console.log('-----------------------------------');
console.log('1. Open YouTube in your browser');
console.log('2. Open Developer Tools (F12)');
console.log('3. Go to Application/Storage -> Cookies');
console.log('4. Copy the cookies and format them as Netscape cookie file\n');

const cookiesPath = path.join(process.cwd(), 'cookies.txt');
if (fs.existsSync(cookiesPath)) {
  console.log('✅ cookies.txt found in current directory!');
  console.log('   The bot will use these cookies for authentication.\n');
} else {
  console.log('❌ cookies.txt not found in current directory.');
  console.log('   The bot will work without cookies but may encounter "Sign in to confirm" errors.\n');
}

console.log('Cookie File Format (Netscape HTTP Cookie File):');
console.log('------------------------------------------------');
console.log('# Netscape HTTP Cookie File');
console.log('# This is a generated file! Do not edit.');
console.log('.youtube.com\tTRUE\t/\tTRUE\t0\tCOOKIE_NAME\tCOOKIE_VALUE');
console.log('\nEach line should contain: domain, flag, path, secure, expiry, name, value');
console.log('(separated by tabs)\n');

console.log('Security Note:');
console.log('--------------');
console.log('⚠️  Your cookies contain sensitive login information.');
console.log('⚠️  Never share your cookies.txt file with others.');
console.log('⚠️  Add cookies.txt to .gitignore (already done).\n');