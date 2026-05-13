const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Carpeta por DNI del docente
    const dni = req.body.dni || req.params.dni || 'sin_dni';
    const dir = path.join(UPLOADS_DIR, dni);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const tipo = file.fieldname === 'archivoDni' ? 'dni' : 'titulo';
    const ts   = Date.now();
    cb(null, `${tipo}_${ts}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB máx por archivo
});

module.exports = upload;