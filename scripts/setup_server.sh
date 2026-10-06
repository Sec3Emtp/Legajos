#!/usr/bin/env bash
set -euo pipefail

# Script de instalación automática (ejecutar con sudo)
# Nota: revisá el contenido antes de ejecutarlo en producción.

if [[ $(id -u) -ne 0 ]]; then
  echo "Ejecuta este script con sudo: sudo ./scripts/setup_server.sh"
  exit 1
fi

APP_DIR="/opt/legajos"
SERVICE_SRC="${APP_DIR}/scripts/legajos.service"
SERVICE_DEST="/etc/systemd/system/legajos.service"

read -p "URL del repositorio git (o deja vacío si ya clonaste): " REPO_URL
read -p "Usuario del sistema que ejecutará la app (ej: ubuntu, pi) [$(logname)]: " RUN_USER
RUN_USER=${RUN_USER:-$(logname)}

echo "Preparando sistema..."
apt update
apt upgrade -y
apt install -y curl git build-essential ufw

echo "Instalando Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

if ! command -v mongod >/dev/null 2>&1; then
  echo "Instalando MongoDB (paquete del sistema)..."
  apt install -y mongodb
  systemctl enable --now mongodb || true
else
  echo "MongoDB ya instalado."
fi

if [[ -n "$REPO_URL" ]]; then
  echo "Clonando repo en $APP_DIR ..."
  mkdir -p $(dirname "$APP_DIR")
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR"
else
  echo "Se asume que el código ya está en $APP_DIR"
fi

echo "Instalando dependencias de la app..."
cd "$APP_DIR"
sudo -u "$RUN_USER" npm install

echo "Creando carpeta de uploads y permisos..."
UPLOADS_DIR=/var/lib/legajos/uploads
mkdir -p "$UPLOADS_DIR"
chown -R "$RUN_USER":"$RUN_USER" "$UPLOADS_DIR"

echo "Creando archivo .env de ejemplo en $APP_DIR/.env"
cat > "$APP_DIR/.env" <<EOF
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/legajos
COOKIE_SECRET=cambiame_una_clave_segura
ADMIN_DNIS=33018460
UPLOADS_DIR=$UPLOADS_DIR
EOF
chown "$RUN_USER":"$RUN_USER" "$APP_DIR/.env"

if [[ -f "$SERVICE_SRC" ]]; then
  echo "Instalando servicio systemd..."
  sed "s|User=YOUR_USERNAME|User=${RUN_USER}|g; s|WorkingDirectory=/opt/legajos|WorkingDirectory=${APP_DIR}|g" "$SERVICE_SRC" > "$SERVICE_DEST"
  chmod 644 "$SERVICE_DEST"
  systemctl daemon-reload
  systemctl enable --now legajos.service
  systemctl status legajos.service --no-pager || true
else
  echo "No se encontró $SERVICE_SRC. Copiá scripts/legajos.service a /etc/systemd/system/legajos.service y editá User/WorkingDirectory." 
fi

echo "Abriendo puerto 3000 en UFW (si está instalado)..."
ufw allow 3000/tcp || true

echo "Instalación finalizada. Comprueba el estado del servicio:"
echo "  sudo systemctl status legajos"
echo "Accede desde otra PC en la LAN: http://<IP_DEL_SERVIDOR>:3000"

echo "Si preferís PM2 en lugar de systemd:"
echo "  sudo npm install -g pm2"
echo "  sudo -u ${RUN_USER} pm2 start Back/server.js --name legajos"
echo "  sudo -u ${RUN_USER} pm2 save"

exit 0
