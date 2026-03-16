# Despliegue Angular en IIS (Generador de Reportes)

## 1) Elegir tipo de URL

- URL raiz (sitio completo): `http://localhost/`
- Subaplicacion (alias): `http://localhost/PruebaGX_Web/`

Si vas a usar `http://localhost/PruebaGX_Web/`, debes compilar con base href `/PruebaGX_Web/`.

## 2) Compilar correctamente

Desde `frontend`:

```powershell
npm install
npm run build:iis:pruebagx
```

Esto genera `dist/generador-reportes-frontend` con:
- `index.html` con `<base href="/PruebaGX_Web/">`
- assets (`main.*.js`, `runtime.*.js`, `styles.*.css`, etc.)
- `web.config` compatible con SPA en IIS

Si el sitio se publica en raiz, usa:

```powershell
npm run build:iis:root
```

## 3) Configurar IIS (subaplicacion)

1. En IIS Manager, sobre `Default Web Site` selecciona `Add Application`.
2. Alias: `PruebaGX_Web`
3. Physical path: carpeta donde copiaras el contenido de `dist/generador-reportes-frontend`
4. Application Pool: `No Managed Code`, modo `Integrated`
5. Asegura que el modulo **URL Rewrite** esta instalado.

Importante: crea **Application**, no solo Virtual Directory.

## 4) Copiar archivos

Copia todo el contenido de `dist/generador-reportes-frontend` al `Physical path` de la aplicacion en IIS.

## 5) Validaciones rapidas

1. Abre `http://localhost/PruebaGX_Web/`
2. En el navegador usa `View Source` y confirma:
   - `<base href="/PruebaGX_Web/">`
3. En `Network`, confirma que cargan en 200:
   - `/PruebaGX_Web/runtime.*.js`
   - `/PruebaGX_Web/polyfills.*.js`
   - `/PruebaGX_Web/main.*.js`
   - `/PruebaGX_Web/styles.*.css`

## 6) Error tipico (pantalla negra + 404 a `/runtime...`)

Si ves 404 a `http://localhost/runtime...` (sin `/PruebaGX_Web/`), la causa es:
- `index.html` con base href incorrecto (`/`), o
- publicaste archivos de otro build, o
- la app no esta creada como `Application` en IIS.

Solucion:
1. Recompila con `npm run build:iis:pruebagx`
2. Recopia archivos a IIS
3. Reinicia la aplicacion en IIS
4. Limpia cache del navegador (Ctrl+F5)
