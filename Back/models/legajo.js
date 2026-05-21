const mongoose = require('mongoose');

const CargoSchema = new mongoose.Schema({
  cupof:          { type: String, default: '' },
  materia:        { type: String, default: '' },  // Materia/PI
  modulos:        { type: String, default: '' },
  revista:        { type: String, default: '' },  // Prov. / Suplente / etc.
  anio:           { type: String, default: '' },  // 1 al 6
  division:       { type: String, default: '' },  // A, B, O, C
  turno:          { type: String, default: '' },  // M o T
  tomaPosesion:   { type: Date,   default: null },
  cese:           { type: Date,   default: null },
  observaciones:  { type: String, default: '' }
});

const ArchivoSchema = new mongoose.Schema({
  nombre:       { type: String, required: true },
  nombreOrig:   { type: String, required: true },
  tipo:         { type: String, required: true },
  mimetype:     { type: String },
  tamanio:      { type: Number },
  subidoEn:     { type: Date, default: Date.now }
});

const LegajoSchema = new mongoose.Schema({
  // Datos personales
  apellidoNombre: { type: String, required: true, trim: true },
  dni:            { type: String, required: true, unique: true, trim: true },
  cuil:           { type: String, required: true, trim: true },
  fechaNac:       { type: Date },

  // Domicilio
  calle:          { type: String, default: '' },
  numero:         { type: String, default: '' },
  localidad:      { type: String, default: '' },
  partido:        { type: String, default: '' },

  // Contacto
  telFijo:        { type: String, default: '' },
  celular:        { type: String, default: '' },
  compania:       { type: String, default: '' },
  mailOficial:    { type: String, default: '' },

  // Antigüedad
  antiguedad:     { type: String, default: '' },

  // Títulos
  tituloPrincipal: { type: String, default: '' },
  institucion:     { type: String, default: '' },
  otrosTitulos:    { type: String, default: '' },

  // Cargos (tabla del frente de la ficha)
  cargos: [CargoSchema],

  // Archivos
  archivos: [ArchivoSchema],

  // Control interno
  estado:       { type: String, enum: ['pendiente', 'completo', 'revision'], default: 'pendiente' },
  notasInternas:{ type: String, default: '' },
  creadoEn:     { type: Date, default: Date.now },
  actualizadoEn:{ type: Date, default: Date.now }
});

// Actualizar fecha en cada save
LegajoSchema.pre('save', function(next) {
  this.actualizadoEn = new Date();
  next();
});

LegajoSchema.pre('findOneAndUpdate', function(next) {
  this.set({ actualizadoEn: new Date() });
  next();
});

module.exports = mongoose.model('Legajo', LegajoSchema);