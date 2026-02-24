# AutoCerebra AI — Backend de Chatbots

Motor multi-tenant para gestionar chatbots de IA para múltiples clientes desde un único servidor.

---

## 🚀 Despliegue en Railway (recomendado — GRATIS para empezar)

### 1. Crear cuenta en Railway
Ve a https://railway.app y crea una cuenta con GitHub.

### 2. Subir el código a GitHub
```bash
git init
git add .
git commit -m "AutoCerebra AI Backend v1"
git remote add origin https://github.com/TU-USUARIO/autocerebra-backend.git
git push -u origin main
```

### 3. Crear proyecto en Railway
1. Railway > New Project > Deploy from GitHub Repo
2. Selecciona tu repositorio
3. Railway detecta Node.js automáticamente

### 4. Configurar variables de entorno
En Railway > tu proyecto > Variables, añade todas las del `.env.example`:
```
ANTHROPIC_API_KEY = sk-ant-api03-...
ADMIN_USER = ismael
ADMIN_PASS = tu-contraseña
JWT_SECRET = cadena-aleatoria-larga
SMTP_USER = ismaelharryrodes2@gmail.com
SMTP_PASS = tu-app-password-gmail
APP_URL = (Railway te dará la URL una vez desplegado)
```

### 5. Obtener URL pública
Railway > Settings > Networking > Generate Domain
Copia la URL y ponla en la variable `APP_URL`.

### 6. Listo ✅
- Panel admin: `https://tu-url.railway.app/admin`
- API: `https://tu-url.railway.app/api`

---

## 💡 Plan de Railway

| Plan       | Precio     | Para qué |
|------------|-----------|----------|
| Hobby      | $5/mes     | Hasta ~10 clientes |
| Pro        | $20/mes    | Crecimiento |
| Team       | $20/usuario| Escala grande |

Con $5/mes tienes más que suficiente para los primeros 10-15 clientes.

---

## 🤖 Añadir un nuevo cliente

### Opción A: Desde el panel admin
1. Ve a `tu-url.railway.app/admin`
2. Login con tus credenciales
3. Chatbots > Nuevo chatbot
4. Rellena el formulario con los datos del cliente
5. Copia el código de instalación (botón 📋)
6. Envíaselo al cliente para que lo pegue en su web

### Opción B: Cuando Ismael me mande el formulario del cliente
Cuando recibas el formulario rellenado por el cliente, Claude genera automáticamente
la configuración completa. Solo tienes que copiarla en el panel.

---

## 📋 Instalación en la web del cliente

El cliente solo tiene que añadir **una línea** antes del `</body>`:

```html
<!-- AutoCerebra AI Chatbot -->
<script src="https://tu-url.railway.app/widget.js?clientId=ID-DEL-CLIENTE"></script>
```

Funciona en: WordPress, Wix, Squarespace, Shopify, HTML estático, o cualquier web.

---

## 🔧 Configurar Google Calendar para un cliente

1. En el panel admin > Chatbots > 📋 (snippet del cliente)
2. Clic en "Conectar Google Calendar →"
3. Se abre una ventana donde el cliente (o tú) autoriza su cuenta de Google
4. Los tokens se guardan automáticamente

---

## 📧 Configurar Gmail para notificaciones

1. Ve a tu cuenta Google > Seguridad > Verificación en 2 pasos (actívala si no la tienes)
2. Ve a Seguridad > Contraseñas de aplicaciones
3. Crear contraseña para "AutoCerebra Backend"
4. Copia la contraseña de 16 dígitos → pon en `SMTP_PASS`

---

## 🗂 Estructura del proyecto

```
autocerebra-backend/
├── server.js           # Entrada principal
├── routes/
│   ├── chat.js         # API del chatbot (usada por el widget)
│   ├── admin.js        # Panel de administración API
│   ├── bookings.js     # Webhooks de Calendly
│   └── widget.js       # Sirve el script embebible
├── services/
│   ├── claude.js       # IA + tool use (el cerebro)
│   ├── db.js           # Base de datos JSON (migrble a PostgreSQL)
│   ├── googleCalendar.js
│   ├── calendly.js
│   └── email.js
├── middleware/
│   └── auth.js         # JWT para el panel admin
├── data/               # Base de datos JSON (auto-generada)
│   ├── clients.json
│   ├── leads.json
│   └── conversations.json
└── admin/
    └── index.html      # Panel de administración completo
```

---

## 🔄 Cuando recibes un formulario de cliente

Ismael manda el formulario rellenado → Claude genera la config → copias en el panel.

El formulario debe incluir:
- Nombre del negocio y descripción
- Servicios con precios
- Horarios de atención
- Preguntas frecuentes
- Email de notificaciones
- Preferencias de reservas (Google Calendar o Calendly)
- Tono y nombre del bot

---

## 📈 Escalar cuando crezcas

Cuando tengas más clientes, puedes migrar de JSON a PostgreSQL añadiendo Railway PostgreSQL
y actualizando `services/db.js`. El resto del código no cambia.

---

**Desarrollado con ❤️ para AutoCerebra AI**
