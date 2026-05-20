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
    const ext = path.extname(file.originalname);
    if (file.fieldname === 'archivoDni') {
      cb(null, `DNI${ext}`);
      return;
    }

    if (!req._tituloNextIndex) {
      const dni = req.body.dni || req.params.dni || 'sin_dni';
      const dir = path.join(UPLOADS_DIR, dni);
      const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      const existing = files
        .map(name => {
          const match = name.match(/^Titulo-(\d+)\.[^.]+$/i);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(Boolean);
      req._tituloNextIndex = existing.length ? Math.max(...existing) + 1 : 1;
    }

    const index = req._tituloNextIndex++;
    cb(null, `Titulo-${index}${ext}`);
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