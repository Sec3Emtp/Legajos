const mongoose = require('mongoose');
require('dotenv').config();
const Legajo = require('./models/legajo');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/legajos';

(async () => {
  try {
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`Conectado a MongoDB en ${mongoUri}`);

    await Legajo.init();
    console.log('Índices de Legajo creados / verificados.');

    console.log('La base de datos local está lista.');
    await conn.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error.message);
    process.exit(1);
  }
})();
