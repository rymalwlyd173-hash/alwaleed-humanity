import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

dotenv.config();
const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized:false } });

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(express.json({ limit:'1mb' }));

function tokenFor(admin){ return jwt.sign({sub:admin.id,email:admin.email},process.env.JWT_SECRET,{expiresIn:'8h'}); }
function auth(req,res,next){
  try{
    const h=req.headers.authorization||'';
    const t=h.startsWith('Bearer ')?h.slice(7):'';
    req.admin=jwt.verify(t,process.env.JWT_SECRET); next();
  }catch{ res.status(401).json({error:'غير مصرح'}); }
}
function requestNumber(){ return 'REQ-'+new Date().getFullYear()+'-'+crypto.randomBytes(4).toString('hex').toUpperCase(); }

app.get('/api/health',(_,res)=>res.json({ok:true}));

app.post('/api/auth/login',async(req,res)=>{
  const {email,password}=req.body||{};
  if(!email||!password) return res.status(400).json({error:'البريد وكلمة المرور مطلوبان'});
  const r=await pool.query('SELECT * FROM admins WHERE email=$1',[email]);
  if(!r.rowCount || !await bcrypt.compare(password,r.rows[0].password_hash)) return res.status(401).json({error:'بيانات الدخول غير صحيحة'});
  res.json({token:tokenFor(r.rows[0])});
});

app.post('/api/requests',async(req,res)=>{
  const {fullName,whatsapp,email,requestType,details}=req.body||{};
  if(!fullName||!whatsapp||!requestType||!details) return res.status(400).json({error:'يرجى إكمال البيانات المطلوبة'});
  const number=requestNumber();
  await pool.query(
    `INSERT INTO requests(request_number,full_name,whatsapp,email,request_type,details) VALUES($1,$2,$3,$4,$5,$6)`,
    [number,fullName.trim(),whatsapp.trim(),email?.trim()||null,requestType,details.trim()]
  );
  res.status(201).json({success:true,requestNumber:number});
});

app.get('/api/requests',auth,async(req,res)=>{
  const r=await pool.query('SELECT * FROM requests ORDER BY created_at DESC');
  res.json(r.rows);
});

app.patch('/api/requests/:id',auth,async(req,res)=>{
  const {status,adminReply}=req.body||{};
  const r=await pool.query(
    `UPDATE requests SET status=COALESCE($1,status), admin_reply=COALESCE($2,admin_reply), updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [status||null,adminReply===undefined?null:adminReply,req.params.id]
  );
  if(!r.rowCount) return res.status(404).json({error:'الطلب غير موجود'});
  res.json(r.rows[0]);
});

app.get('/api/requests/:number',async(req,res)=>{
  const r=await pool.query(
    'SELECT request_number,status,admin_reply,created_at,updated_at FROM requests WHERE request_number=$1',
    [req.params.number]
  );
  if(!r.rowCount) return res.status(404).json({error:'لم يتم العثور على الطلب'});
  res.json(r.rows[0]);
});

app.listen(process.env.PORT||3000,()=>console.log('API running'));
