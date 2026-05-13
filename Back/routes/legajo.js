const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const Legajo   = require('../models/Legajo');
const upload   = require('../middleware/upload');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');

// ─── GET /api/legajos ──────────────────────────────────────────────────────────
// Lista todos los legajos (con filtro opcional por estado y búsqueda por nombre/DNI)
router.get('/', async (req, res) => {
  try {
    const { estado, q } = req.query;
    const filtro = {};
    if (estado) filtro.estado = estado;
    if (q) filtro.$or = [
      { apellidoNombre: { $regex: q, $options: 'i' } },
      { dni: { $regex: q, $options: 'i' } }
    ];
    const legajos = await Legajo.find(filtro)
      .select('apellidoNombre dni cuil estado creadoEn actualizadoEn cargos tituloPrincipal')
      .sort({ actualizadoEn: -1 });
    res.json({ ok: true, data: legajos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/legajos/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const legajo = await Legajo.findById(req.params.id);
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });
    res.json({ ok: true, data: legajo });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/legajos ─────────────────────────────────────────────────────────
// Crea un nuevo legajo (desde el formulario del docente)
router.post('/',
  upload.fields([
    { name: 'archivoDni',     maxCount: 2 },
    { name: 'archivosTitulos', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const body = req.body;

      // Verificar que el DNI no exista ya
      const existe = await Legajo.findOne({ dni: body.dni });
      if (existe) {
        return res.status(409).json({ ok: false, error: 'Ya existe un legajo con ese DNI.' });
      }

      // Mapear archivos subidos
      const archivos = [];
      const mapearArchivos = (files, tipo) => {
        if (!files) return;
        files.forEach(f => archivos.push({
          nombre:     f.filename,
          nombreOrig: f.originalname,
          tipo,
          mimetype:   f.mimetype,
          tamanio:    f.size
        }));
      };
      if (req.files) {
        mapearArchivos(req.files['archivoDni'],      'dni');
        mapearArchivos(req.files['archivosTitulos'], 'titulo');
      }

      const legajo = new Legajo({
        apellidoNombre:  body.apellidoNombre,
        dni:             body.dni,
        cuil:            body.cuil,
        fechaNac:        body.fechaNac  || null,
        calle:           body.calle     || '',
        numero:          body.numero    || '',
        localidad:       body.localidad || '',
        partido:         body.partido   || '',
        telFijo:         body.telFijo   || '',
        celular:         body.celular   || '',
        compania:        body.compania  || '',
        mailOficial:     body.mailOficial || '',
        antiguedad:      body.antiguedad || '',
        tituloPrincipal: body.tituloPrincipal || '',
        institucion:     body.institucion || '',
        otrosTitulos:    body.otrosTitulos || '',
        archivos,
        cargos: []
      });

      await legajo.save();
      res.status(201).json({ ok: true, data: legajo });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// ─── PUT /api/legajos/:id ──────────────────────────────────────────────────────
// Actualiza datos del legajo (secretaría)
router.put('/:id', async (req, res) => {
  try {
    const { cargos, estado, notasInternas, ...datos } = req.body;
    const update = { ...datos };
    if (cargos !== undefined)       update.cargos       = cargos;
    if (estado !== undefined)       update.estado       = estado;
    if (notasInternas !== undefined) update.notasInternas = notasInternas;

    const legajo = await Legajo.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });
    res.json({ ok: true, data: legajo });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/legajos/:id/archivos ───────────────────────────────────────────
// Agrega archivos a un legajo existente (la secretaria sube algo manualmente)
router.post('/:id/archivos',
  async (req, res, next) => {
    // Necesitamos el DNI para la carpeta; lo obtenemos del legajo
    const legajo = await Legajo.findById(req.params.id).select('dni');
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });
    req.params.dni = legajo.dni;
    next();
  },
  upload.fields([
    { name: 'archivoDni',      maxCount: 2  },
    { name: 'archivosTitulos', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const legajo = await Legajo.findById(req.params.id);
      if (req.files) {
        const mapear = (files, tipo) => {
          if (!files) return;
          files.forEach(f => legajo.archivos.push({
            nombre:     f.filename,
            nombreOrig: f.originalname,
            tipo,
            mimetype:   f.mimetype,
            tamanio:    f.size
          }));
        };
        mapear(req.files['archivoDni'],      'dni');
        mapear(req.files['archivosTitulos'], 'titulo');
      }
      await legajo.save();
      res.json({ ok: true, data: legajo.archivos });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// ─── GET /api/legajos/:id/archivos/:nombre ────────────────────────────────────
// Descarga un archivo del legajo
router.get('/:id/archivos/:nombre', async (req, res) => {
  try {
    const legajo = await Legajo.findById(req.params.id).select('dni archivos');
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });

    const archivo = legajo.archivos.find(a => a.nombre === req.params.nombre);
    if (!archivo) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });

    const filePath = path.join(UPLOADS_DIR, legajo.dni, archivo.nombre);
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado en disco' });

    res.setHeader('Content-Disposition', `attachment; filename="${archivo.nombreOrig}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── DELETE /api/legajos/:id/archivos/:nombre ─────────────────────────────────
router.delete('/:id/archivos/:nombre', async (req, res) => {
  try {
    const legajo = await Legajo.findById(req.params.id);
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });

    const idx = legajo.archivos.findIndex(a => a.nombre === req.params.nombre);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });

    const filePath = path.join(UPLOADS_DIR, legajo.dni, req.params.nombre);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    legajo.archivos.splice(idx, 1);
    await legajo.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── DELETE /api/legajos/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const legajo = await Legajo.findByIdAndDelete(req.params.id);
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });

    // Borrar carpeta de archivos
    const dir = path.join(UPLOADS_DIR, legajo.dni);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;