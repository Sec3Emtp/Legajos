const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/legajos';
const adminDnis = (process.env.ADMIN_DNIS || process.env.ALLOWED_DNIS || '33018460')
  .split(',')
  .map(d => d.trim())
  .filter(Boolean);
const cookieSecret = process.env.COOKIE_SECRET || 'cambiame123';

const isValidDni = dni => /^[0-9]{7,8}$/.test(dni);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(cookieSecret));

const authMiddleware = (req, res, next) => {
  const dni = req.signedCookies?.docenteDni;
  if (!dni || !isValidDni(dni)) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ ok: false, error: 'No autorizado' });
    }
    return res.redirect('/login');
  }
  req.docenteDni = dni;
  req.isAdmin = adminDnis.includes(dni);
  next();
};

app.post('/login', (req, res) => {
  const { dni } = req.body;
  if (!dni || typeof dni !== 'string') {
    return res.status(400).json({ ok: false, error: 'DNI inválido' });
  }

  const normalized = dni.replace(/\D/g, '');
  if (!isValidDni(normalized)) {
    return res.status(400).json({ ok: false, error: 'DNI inválido' });
  }

  const isAdmin = adminDnis.includes(normalized);
  res.cookie('docenteDni', normalized, {
    signed: true,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8
  });
  res.json({ ok: true, admin: isAdmin });
});

app.post('/logout', (req, res) => {
  res.clearCookie('docenteDni');
  res.json({ ok: true });
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../Front/login.html'));
});

app.get('/admin', authMiddleware, (req, res) => {
  if (!req.isAdmin) return res.redirect('/form');
  res.sendFile(path.join(__dirname, '../Front/admin.html'));
});

app.get('/form', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../Front/formulario-docente.html'));
});

app.get('/formulario-cargos', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../Front/formulario-cargos.html'));
});

app.get('/formulario-cargos.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../Front/formulario-cargos.html'));
});

app.use('/api/legajos', authMiddleware, require('./routes/legajo'));

app.get('/', (req, res) => {
  res.redirect('/login');
});

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB conectado');
    app.listen(port, () => {
      console.log(`Servidor iniciado en http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Error al conectar MongoDB:', err.message);
    process.exit(1);
  });
