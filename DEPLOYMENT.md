# Despliegue en una PC para usarla como servidor en la LAN (guía paso a paso)

Esta guía explica, paso a paso y con comandos listos para copiar, cómo convertir una PC común (Ubuntu/Debian) en un servidor que aloje esta aplicación (`Back/` + `Front/`) y MongoDB, y cómo hacer que todo se inicie automáticamente al encender la PC.

Si no usás Ubuntu/Debian algunos comandos pueden variar. Lee cada paso con calma y pegá los comandos en la terminal como root o con `sudo`.

---

Resumen rápido (lo mínimo que necesitás):

- Tener la PC conectada a la LAN.
- Instalar Node.js (v16+ recomendada) y `npm` o `pnpm`.
- Instalar MongoDB (o usar un servidor Mongo separado).
- Clonar este repositorio en la PC servidor.
- Crear un archivo `.env` con las variables necesarias.
- Instalar dependencias y habilitar el servicio para que arranque con el sistema.
-

---

1) Preparar la PC (actualizar paquetes)

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

2) Instalar Node.js (ejemplo con Node 18 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

3) Instalar MongoDB (opción simple: paquete del sistema)

```bash
sudo apt install -y mongodb
sudo systemctl enable --now mongodb
sudo systemctl status mongodb
```

Si preferís la versión oficial `mongodb-org` sigue la docs oficiales de MongoDB para tu distro.

4) Configurar red: reservar IP o usar DHCP estático

- Recomendado: dar a la PC una IP estática en la LAN (ej. 192.168.1.50) desde el router o configurar la NIC localmente.
- Para pruebas con DHCP, anotar la IP actual con:

```bash
ip addr show
hostname -I
```

Vas a acceder desde otras máquinas con `http://IP:3000` (por defecto el servidor usa el puerto 3000).

5) Clonar el proyecto y prepararlo

```bash
cd /opt
sudo git clone <TU_REPO_URL> legajos
cd legajos
sudo chown -R $USER:$USER .
npm install
```

6) Crear el archivo de configuración `.env`

En la raíz del proyecto crea un archivo `.env` con estas variables (ajustá valores):

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/legajos
COOKIE_SECRET=cambiame_una_clave_segura
ADMIN_DNIS=33018460
UPLOADS_DIR=/var/lib/legajos/uploads
```

- `UPLOADS_DIR`: carpeta donde se almacenarán los archivos; crearla y dar permisos.

```bash
sudo mkdir -p /var/lib/legajos/uploads
sudo chown -R $USER:$USER /var/lib/legajos/uploads
```

7) Inicializar la base de datos (si aplica)

Si el proyecto tiene un script para inicializar datos (ver `package.json`):

```bash
npm run init-db
```

8) Probar manualmente la aplicación

```bash
npm run start
```

Abrí en otra máquina de la LAN: `http://IP_DEL_SERVIDOR:3000`.

Si todo funciona, detené el proceso (Ctrl+C) y sigue con la automatización.

9) Configurar `systemd` para arrancar al inicio (método recomendado)

- Crear un servicio `systemd` para la app. Como `root` crea el archivo `/etc/systemd/system/legajos.service` con este contenido:

```ini
[Unit]
Description=Legajos app (Node.js)
After=network.target mongodb.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/legajos
EnvironmentFile=/opt/legajos/.env
ExecStart=/usr/bin/node Back/server.js
Restart=on-failure
RestartSec=5s
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=legajos

[Install]
WantedBy=multi-user.target
```

Reemplazá `YOUR_USERNAME` por el usuario que corre la app (ej. `ubuntu` o `pi`).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now legajos.service
sudo systemctl status legajos.service
journalctl -u legajos -f
```

10) Alternativa: usar `pm2` (gestor de procesos Node)

```bash
sudo npm install -g pm2
pm2 start Back/server.js --name legajos
pm2 save
pm2 startup systemd
```

El comando `pm2 startup` devuelve otro comando que hay que ejecutar con `sudo`.

11) Abrir puerto en el cortafuegos (si usás `ufw`)

```bash
sudo ufw allow 3000/tcp
sudo ufw enable
sudo ufw status
```

12) Probar desde otra PC en la LAN

- En una máquina de la misma red, abre el navegador y visita `http://IP_DEL_SERVIDOR:3000`.
- Para acceder al administrador: `http://IP:3000/admin` (necesitás iniciar sesión; ver `ADMIN_DNIS`).

13) Notas de seguridad y buenas prácticas

- Nunca uses `COOKIE_SECRET` por defecto; pon una clave larga y secreta.
- Si abrís este servidor a Internet, configurá HTTPS (reverse proxy con Nginx + Let's Encrypt).
- Limitá el acceso a MongoDB por IP o usa autenticación de usuario en `MONGO_URI`.
- Considerá rotar backups de `/var/lib/legajos/uploads` y exportar copias de la base de datos regularmente.

14) Comprobaciones rápidas si algo falla

- Ver logs de systemd: `sudo journalctl -u legajos -n 200 --no-pager`
- Ver los logs de Mongo: `sudo journalctl -u mongodb -n 200 --no-pager` o los archivos en `/var/log`.
- Comprobar que la app muestra las IPs LAN al iniciarse (el `console.log` en `Back/server.js`).

---

¿Querés que cree también el archivo de servicio `systemd` en el repositorio con los valores por defecto (para que lo copies y edites), o preferís que lo configure yo aquí mismo si tengo acceso SSH a la PC?
