// Run once with: npm run seed:admin
// Creates (or updates the password of) the first admin account from
// SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD in server/.env.
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Admin from '../models/Admin.js';

async function run() {
  await connectDB();

  const username = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password || password === 'change_this_password') {
    console.error('Set SEED_ADMIN_PASSWORD in server/.env to a real password before seeding.');
    process.exit(1);
  }

  let admin = await Admin.findOne({ username });
  if (admin) {
    admin.password = password;
    await admin.save();
    console.log(`Updated password for existing admin "${username}".`);
  } else {
    admin = await Admin.create({ username, password, role: 'superadmin' });
    console.log(`Created admin "${username}".`);
  }

  console.log('Done. You can now log in at /admin/login with this username/password.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
