# Legajos

Sistema de registro de legajos docentes para funcionar en una red local de escuela.

## Requisitos

- Node.js 18+ instalado
- pnpm instalado localmente
- MongoDB instalado y ejecutándose en el servidor local de la escuela

## Configuración

1. Copiar el ejemplo de variables de entorno:

   ```bash
   cp .env.example .env
   ```

2. Si MongoDB se ejecuta en la misma máquina, dejar `MONGO_URI` como:

   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/legajos
   ```

3. Si el servidor de la escuela usa otra IP, cambiar `127.0.0.1` por la IP local del servidor.

## Instalación

```bash
pnpm install
```

## Inicializar la base de datos local

Antes de arrancar la aplicación, inicializá la base de datos local:

```bash
pnpm run init-db
```

## Ejecución

```bash
pnpm dev
```

o

```bash
pnpm start
```

## Acceso

- Abrir `http://localhost:3000` desde el servidor donde se ejecuta la app.
- Si los docentes acceden desde otras máquinas de la escuela, usar la IP local del servidor, por ejemplo `http://192.168.1.10:3000`.

## Login

- Ingresar con el número de DNI en la pantalla de login.
- Solo los DNI permitidos en `ALLOWED_DNIS` podrán autenticarse.
- Los DNI listados en `ADMIN_DNIS` podrán ver el panel administrador en `/admin`.
- La ruta protegida `/form` muestra la carga de cargos del legajo.
- Para habilitar más DNI, agregar los números separados por comas en el `.env`:

```env
ALLOWED_DNIS=33018460,12345678,87654321
ADMIN_DNIS=33018460,12345678
```

## Detalle

- El frontend está en `Front/formulario-docente.html`
- El backend está en `Back/server.js`
- El modelo de datos usa MongoDB local por `MONGO_URI`
- La base de datos se crea en MongoDB al ejecutar `pnpm run init-db`
- Los archivos subidos se guardan en `uploads/` por DNI
