# Defensa del proyecto

## Qué hace

Desarrollé una API backend que permite iniciar sesión con Google OAuth 2.0, guardar o vincular usuarios en PostgreSQL y emitir un JWT propio. La ruta `GET /users/profile` exige ese token y devuelve la identidad autenticada.

## Por qué

Separé autenticación, usuarios y acceso a datos para que cada parte tenga una responsabilidad clara y el flujo sea fácil de mantener y explicar. Google verifica la identidad; el JWT de la aplicación protege las solicitudes posteriores sin usar sesiones ni guardar tokens de Google.

## Cómo

`GoogleStrategy` valida el perfil y lo entrega a `AuthService`. `UsersService` busca por Google ID o email, vincula una cuenta existente o crea una nueva mediante Prisma. Después, `AuthService` firma un JWT mínimo con `sub` y `email`. `JwtStrategy` y `JwtAuthGuard` validan el Bearer token antes de permitir el acceso al perfil.

La solución usa NestJS, TypeScript, Prisma y PostgreSQL. Se comprueba con `npm test`, `npm run test:e2e`, `npm run lint` y `npm run build`; las pruebas cubren persistencia, vinculación, redirect OAuth y acceso JWT válido, ausente, inválido y expirado.

## Puesta en marcha y prueba

### Requisitos

- Node.js `^20.19`, `^22.12` o `>=24` y npm.
- PostgreSQL activo.
- Un proyecto de Google Cloud con una cuenta de prueba.

Ejecuta todos los comandos desde la raíz del proyecto, donde está `package.json`.

### Instalar y configurar PostgreSQL

Instala dependencias y crea el archivo local de entorno:

```bash
npm ci
cp .env.example .env
```

En PostgreSQL, crea el rol y la base de datos. Reemplaza la contraseña de ejemplo por una elegida localmente:

```sql
CREATE ROLE oauth_google_api LOGIN PASSWORD 'REEMPLAZAR_POR_CLAVE_LOCAL';
ALTER ROLE oauth_google_api CREATEDB;
CREATE DATABASE oauth_google_api OWNER oauth_google_api;
```

`CREATEDB` permite a Prisma crear la base shadow usada por `migrate dev`. Si la autenticación local no admite contraseña, configura el acceso de loopback (`127.0.0.1`) para usar `scram-sha-256` y recarga PostgreSQL.

### Configurar Google OAuth y `.env`

En Google Cloud Console, crea un cliente OAuth de tipo **Web application**. Configura exactamente:

- Origen JavaScript autorizado: `http://localhost:3000`
- URI de redireccionamiento autorizada: `http://localhost:3000/auth/google/redirect`

Si la aplicación está en modo de prueba, agrega la cuenta del profesor en **Test users**. Completa `.env` con los valores del cliente y la base local:

```env
DATABASE_URL="postgresql://oauth_google_api:CLAVE_LOCAL@127.0.0.1:5432/oauth_google_api?schema=public"
GOOGLE_CLIENT_ID="ID_DE_CLIENTE"
GOOGLE_CLIENT_SECRET="SECRETO_DE_CLIENTE"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/redirect"
JWT_SECRET=""
JWT_EXPIRES_IN="1h"
PORT=3000
```

Genera el secreto JWT localmente con `openssl rand -hex 32` y coloca el resultado en `JWT_SECRET`. No subas `.env` ni compartas los secretos.

### Migrar y arrancar

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run build
npm run start:dev
```

Mantén el servidor en ejecución. Abre `http://localhost:3000/auth/google`, inicia sesión con la cuenta de prueba y acepta el consentimiento. El callback devuelve `access_token` y el usuario persistido.

### Probar la ruta privada

Sin token debe devolver `401`:

```bash
curl -i http://localhost:3000/users/profile
```

Para probar con el token del callback sin mostrarlo mientras se escribe en la terminal:

```bash
read -rsp "Access token: " TOKEN; echo
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/users/profile
unset TOKEN
```

Con un JWT vigente, el resultado esperado es `200` y el `id` y email del usuario. Las pruebas automatizadas también cubren tokens inválidos y expirados:

```bash
npm test
npm run test:e2e
npm run lint
npm run build
```
