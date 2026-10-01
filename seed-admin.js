import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
dotenv.config();
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes('localhost')?false:{rejectUnauthorized:false}});
const hash=await bcrypt.hash(process.env.ADMIN_PASSWORD,12);
await pool.query(`INSERT INTO admins(email,password_hash) VALUES($1,$2)
ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
[process.env.ADMIN_EMAIL,hash]);
console.log('Admin account ready:',process.env.ADMIN_EMAIL);
await pool.end();
