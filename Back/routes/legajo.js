const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const Legajo   = require('../models/legajo');
const upload   = require('../middlewares/upload');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');

const adminOnly = (req, res, next) => {
  if (!req.isAdmin) {
    return res.status(403).json({ ok: false, error: 'Acceso restringido' });
  }
  next();
};

// ─── GET /api/legajos ──────────────────────────────────────────────────────────
// Lista todos los legajos (con filtro opcional por estado y búsqueda por nombre/DNI)
router.get('/', adminOnly, async (req, res) => {
  try {
    const { estado, q } = req.query;
    const filtro = {};
    if (estado) filtro.estado = estado;
    if (q) filtro.$or = [
      { apellidoNombre: { $regex: q, $options: 'i' } },
      { dni: { $regex: q, $options: 'i' } }
    ];
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [total, legajos] = await Promise.all([
      Legajo.countDocuments(filtro),
      Legajo.find(filtro)
        .select('apellidoNombre dni cuil estado creadoEn actualizadoEn cargos tituloPrincipal')
        .sort({ actualizadoEn: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.json({ ok: true, data: legajos, page, limit, total });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/legajos/mi-legajo ─────────────────────────────────────────────────
router.get('/mi-legajo', async (req, res) => {
  try {
    const dni = req.docenteDni;
    if (!dni) return res.status(401).json({ ok: false, error: 'No autorizado', isAdmin: req.isAdmin });

    const legajo = await Legajo.findOne({ dni });
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado', isAdmin: req.isAdmin });
    res.json({ ok: true, data: legajo, isAdmin: req.isAdmin });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, isAdmin: req.isAdmin });
  }
});

// ─── POST /api/legajos/cargos ───────────────────────────────────────────────────
router.post('/cargos', async (req, res) => {
  try {
    const dni = req.docenteDni;
    if (!dni) return res.status(401).json({ ok: false, error: 'No autorizado' });

    const { legajoId } = req.body;
    let legajo;
    if (req.isAdmin && legajoId) {
      legajo = await Legajo.findById(legajoId);
    } else {
      legajo = await Legajo.findOne({ dni });
    }

    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });

    const cargos = Array.isArray(req.body.cargos) ? req.body.cargos : [];
    if (!cargos.length) {
      return res.status(400).json({ ok: false, error: 'No se enviaron cargos' });
    }

    legajo.cargos = cargos.map(cargo => ({
      cupof: cargo.cupof || '',
      materia: cargo.materia || '',
      revista: cargo.revista || '',
      carga: cargo.carga || '',
      a: cargo.a || '',
      d: cargo.d || '',
      t: cargo.t || '',
      tomaPosesion: cargo.tomaPosesion || null,
      cese: cargo.cese || null,
      observaciones: cargo.observaciones || ''
    }));

    await legajo.save();
    res.json({ ok: true, data: legajo.cargos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/legajos/:id ──────────────────────────────────────────────────────
router.get('/:id', adminOnly, async (req, res) => {
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
    const legajo = await Legajo.findById(req.params.id);
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });

    if (!req.isAdmin && legajo.dni !== req.docenteDni) {
      return res.status(403).json({ ok: false, error: 'No autorizado para actualizar este legajo' });
    }

    const { cargos, estado, notasInternas, ...datos } = req.body;
    const update = { ...datos };
    if (cargos !== undefined)       update.cargos       = cargos;
    if (estado !== undefined)       update.estado       = estado;
    if (notasInternas !== undefined) update.notasInternas = notasInternas;

    Object.assign(legajo, update);
    await legajo.save();
    res.json({ ok: true, data: legajo });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/legajos/:id/archivos ───────────────────────────────────────────
// Agrega archivos a un legajo existente (la secretaria sube algo manualmente)
router.post('/:id/archivos',
  adminOnly,
  async (req, res, next) => {
    // Necesitamos el DNI para la carpeta; lo obtenemos del legajo
    const legajo = await Legajo.findById(req.params.id).select('dni');
    if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });
    req.params.dni = legajo.dni;
    next();
  },
  upload.fields([
    { name: 'archivoDni',      maxCount: 2  },
    { name: 'archivosTitulos', maxCount: 10 },
    { name: 'archivos',        maxCount: 100 }
  ]),
  async (req, res) => {
    try {
      const legajo = await Legajo.findById(req.params.id);
      if (!legajo) return res.status(404).json({ ok: false, error: 'Legajo no encontrado' });

      if (req.files && req.files['archivoDni']) {
        const dniArchivos = legajo.archivos.filter(a => a.tipo === 'dni');
        dniArchivos.forEach(file => {
          const filePath = path.join(UPLOADS_DIR, legajo.dni, file.nombre);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        legajo.archivos = legajo.archivos.filter(a => a.tipo !== 'dni');
      }

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
        mapear(req.files['archivos'],        'documento');
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

module.exports = router;

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